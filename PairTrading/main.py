import os
import requests
import pandas as pd
import numpy as np
import json
from pykalman import KalmanFilter
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv()
API_KEY = os.getenv("TIINGO_KEY")
TICKER_A = "SPY" # Dependent Variable (Y)
TICKER_B = "QQQ" # Independent Variable (X)
LOOKBACK_YEARS = 2
LEVERAGE = 10

def fetch_tiingo_data(ticker, start_date, api_key):
    """Fetches historical data matching the Researcher logic exactly."""
    headers = {'Content-Type': 'application/json'}
    url = f"https://api.tiingo.com/tiingo/daily/{ticker}/prices?startDate={start_date}&token={api_key}"
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date').sort_index()
        return df['adjClose']
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None
def run_strategy():
    print(f"--- STARTING PRODUCTION RUN ({TICKER_A}/{TICKER_B}) ---")
    
    # 1. Sync Time Window exactly with Researcher
    # Calculate start date: Today - 2 Years
    start_date = (datetime.now() - timedelta(days=LOOKBACK_YEARS*365)).strftime('%Y-%m-%d')
    print(f"Fetching data from: {start_date}")

    series_a = fetch_tiingo_data(TICKER_A, start_date, API_KEY)
    series_b = fetch_tiingo_data(TICKER_B, start_date, API_KEY)

    if series_a is None or series_b is None:
        print("Data fetch failed.")
        return

    # 2. Align Data
    df = pd.concat([series_a, series_b], axis=1).dropna()
    df.columns = ['price_a', 'price_b']
    
    # Note: We do NOT do .iloc[-504:] here anymore. 
    # We use the full dataset fetched from start_date to ensure KF path matches backtest.

    # 3. Kalman Filter (Identical settings to Researcher)
    obs_mat = df['price_b'].values[:, np.newaxis, np.newaxis]
    kf = KalmanFilter(
        transition_matrices=[1],
        observation_matrices=obs_mat,
        initial_state_mean=0,
        initial_state_covariance=1,
        observation_covariance=1,
        transition_covariance=0.01
    )
    
    state_means, _ = kf.filter(df['price_a'].values)
    df['beta'] = state_means.flatten()

    # 4. Signals
    df['spread'] = df['price_a'] - (df['beta'] * df['price_b'])
    df['z_score'] = (df['spread'] - df['spread'].rolling(20).mean()) / df['spread'].rolling(20).std()

    # 5. Performance (Leveraged)
    df['ret_a'] = df['price_a'].pct_change()
    df['ret_b'] = df['price_b'].pct_change()
    
    df['position'] = -np.sign(df['z_score'])
    df['spread_ret'] = df['position'].shift(1) * (df['ret_a'] - df['beta'].shift(1) * df['ret_b'])
    
    df['leveraged_ret'] = df['spread_ret'] * LEVERAGE
    df['leveraged_ret'] = df['leveraged_ret'].clip(lower=-0.99) # Cap daily loss at 99%

    df['cum_strategy'] = (1 + df['leveraged_ret'].fillna(0)).cumprod()
    df['cum_buy_hold'] = (1 + df['ret_a'].fillna(0)).cumprod()

    # --- DEBUGGING ---
    last_z = df['z_score'].iloc[-1]
    last_beta = df['beta'].iloc[-1]
    print(f"Current Z-Score: {last_z:.4f}")
    print(f"Current Beta: {last_beta:.4f}")

    # --- OUTPUT ---
    output_data = {
        "metadata": {
            "pair": f"{TICKER_A} / {TICKER_B}",
            "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M UTC"),
            "current_z": round(last_z, 2) if not np.isnan(last_z) else 0,
            "current_beta": round(last_beta, 3) if not np.isnan(last_beta) else 0,
            "current_price_a": round(df['price_a'].iloc[-1], 2),
            "current_price_b": round(df['price_b'].iloc[-1], 2),
            "leverage": f"{LEVERAGE}x"
        },
        "dates": df.index.strftime('%Y-%m-%d').tolist(),
        "z_score": df['z_score'].fillna(0).tolist(),
        "beta": df['beta'].fillna(0).tolist(),
        "cum_strategy": df['cum_strategy'].tolist(),
        "cum_buy_hold": df['cum_buy_hold'].tolist()
    }

    # --- OUTPUT JSON ---
    output_data = {
        "metadata": {
            "pair": f"{TICKER_A} / {TICKER_B}",
            "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M UTC"),
            "current_z": round(df['z_score'].iloc[-1], 2) if not np.isnan(df['z_score'].iloc[-1]) else 0,
            "current_beta": round(df['beta'].iloc[-1], 3) if not np.isnan(df['beta'].iloc[-1]) else 0,
            "current_price_a": round(df['price_a'].iloc[-1], 2),
            "leverage": f"{int(LEVERAGE)}x"
        },
        "dates": df.index.strftime('%Y-%m-%d').tolist(),
        "z_score": df['z_score'].fillna(0).tolist(),
        "beta": df['beta'].fillna(0).tolist(),
        "cum_strategy": df['cum_strategy'].tolist(),
        "cum_buy_hold": df['cum_buy_hold'].tolist()
    }

    with open('Pairtrading/dashboard_data.json', 'w') as f:
        json.dump(output_data, f)
    
    print(f"Success: dashboard_data.json updated with {LEVERAGE}x leverage.")

if __name__ == "__main__":
    if not API_KEY:
        raise ValueError("TIINGO_API_KEY not found in environment variables.")
    run_strategy()