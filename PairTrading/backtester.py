import os
import requests
import pandas as pd
import numpy as np
from pykalman import KalmanFilter
from itertools import combinations
from tabulate import tabulate
from datetime import datetime, timedelta
from dotenv import load_dotenv
# --- CONFIGURATION ---
load_dotenv()
API_KEY = os.getenv("TIINGO_KEY")
TICKERS = ['GDX', 'GLD', 'USO', 'XLE', 'EWC', 'EWA', 'XLF', 'XLU', 'SPY', 'QQQ', 'TLT', 'TBT']
LEVERAGE = 10.0       # Leverage for the Pairs Strategy
YEARS = 2             # Lookback period in years

def fetch_tiingo_data(ticker, start_date, api_key):
    """Fetches historical data for a single ticker from Tiingo."""
    headers = {'Content-Type': 'application/json'}
    url = f"https://api.tiingo.com/tiingo/daily/{ticker}/prices?startDate={start_date}&token={api_key}"
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status() # Check for HTTP errors
        data = response.json()
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date').sort_index()
        return df['adjClose']
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None

def get_data_tiingo(tickers, years, api_key):
    print(f"Fetching data for {len(tickers)} tickers from Tiingo...")
    start_date = (datetime.now() - timedelta(days=years*365)).strftime('%Y-%m-%d')
    
    combined_data = {}
    
    for ticker in tickers:
        print(f"  - Downloading {ticker}...")
        series = fetch_tiingo_data(ticker, start_date, api_key)
        if series is not None:
            combined_data[ticker] = series
            
    # Combine into a single DataFrame (Date index, Ticker columns)
    df = pd.DataFrame(combined_data)
    return df.dropna()

def run_kalman_strategy(df, ticker_a, ticker_b, leverage):
    # 1. Setup Data
    # Ensure we only use rows where both tickers have data
    pair_df = df[[ticker_a, ticker_b]].dropna().copy()
    pair_df.columns = ['price_a', 'price_b']
    
    if len(pair_df) < 100: # Skip if not enough data
        return None, None, None

    # 2. Kalman Filter (Dynamic Beta)
    obs_mat = pair_df['price_b'].values[:, np.newaxis, np.newaxis]
    kf = KalmanFilter(
        transition_matrices=[1],
        observation_matrices=obs_mat,
        initial_state_mean=0,
        initial_state_covariance=1,
        observation_covariance=1,
        transition_covariance=0.01
    )
    state_means, _ = kf.filter(pair_df['price_a'].values)
    pair_df['beta'] = state_means.flatten()
    
    # 3. Signals (Z-Score)
    pair_df['spread'] = pair_df['price_a'] - (pair_df['beta'] * pair_df['price_b'])
    pair_df['z_score'] = (pair_df['spread'] - pair_df['spread'].rolling(20).mean()) / pair_df['spread'].rolling(20).std()
    
    # 4. Returns
    pair_df['ret_a'] = pair_df['price_a'].pct_change()
    pair_df['ret_b'] = pair_df['price_b'].pct_change()
    
    # Strategy Logic (Short Spread if Z > 0, Long if Z < 0)
    pair_df['position'] = -np.sign(pair_df['z_score'])
    
    # Strategy Return
    pair_df['strat_ret'] = pair_df['position'].shift(1) * (pair_df['ret_a'] - pair_df['beta'].shift(1) * pair_df['ret_b'])
    
    # Apply Leverage
    pair_df['lev_ret'] = pair_df['strat_ret'] * leverage
    pair_df['lev_ret'] = pair_df['lev_ret'].clip(lower=-0.99) # Bankruptcy protection
    
    # 5. Benchmarks
    pair_df['hold_ret'] = 0.5 * pair_df['ret_a'] + 0.5 * pair_df['ret_b']
    
    pair_df['cum_strat'] = (1 + pair_df['lev_ret'].fillna(0)).cumprod()
    pair_df['cum_hold']  = (1 + pair_df['hold_ret'].fillna(0)).cumprod()
    
    total_strat_return = (pair_df['cum_strat'].iloc[-1] - 1) * 100
    total_hold_return = (pair_df['cum_hold'].iloc[-1] - 1) * 100
    
    return total_strat_return, total_hold_return, pair_df['z_score'].iloc[-1]

def main():
    if not API_KEY:
        print("Error: TIINGO_API_KEY environment variable not set.")
        return

    # Fetch Data
    df_data = get_data_tiingo(TICKERS, YEARS, API_KEY)
    
    results = []
    
    # Generate Pairs
    # Only use tickers that were successfully fetched
    valid_tickers = df_data.columns.tolist()
    pairs = list(combinations(valid_tickers, 2))
    
    print(f"\nBacktesting {len(pairs)} pairs with {LEVERAGE}x leverage...\n")
    
    for t1, t2 in pairs:
        try:
            strat_ret, hold_ret, current_z = run_kalman_strategy(df_data, t1, t2, LEVERAGE)
            
            if strat_ret is not None:
                results.append({
                    "Pair": f"{t1}/{t2}",
                    "Strategy %": round(strat_ret, 2),
                    "50/50 Hold %": round(hold_ret, 2),
                    "Alpha %": round(strat_ret - hold_ret, 2),
                    "Curr Z": round(current_z, 2)
                })
        except Exception as e:
            print(f"Error calculating {t1}/{t2}: {e}")
            continue

    if not results:
        print("No results generated.")
        return

    # Output Results
    df_results = pd.DataFrame(results).sort_values(by='Strategy %', ascending=False)
    
    print(tabulate(df_results.head(20), headers="keys", tablefmt="grid", showindex=False))
    df_results.to_csv("strategy_results.csv", index=False)
    print("\nFull results saved to 'strategy_results.csv'")

if __name__ == "__main__":
    main()