import os
import pandas as pd
import json
import requests
import xml.etree.ElementTree as ET
import datetime as dt
from dotenv import load_dotenv

# --- Configuration ---
load_dotenv() 

ENTSOE_KEY = os.getenv("ENTSOE_KEY")
AREA_CODE = "10YCH-SWISSGRIDZ" 
MAX_CAPACITY_MWH = 500.0
INITIAL_LEVEL_MWH = 250.0 
PUMP_POWER_MW = 50.0 
TURBINE_POWER_MW = 50.0    
ROUND_TRIP_EFFICIENCY = 0.80 
OUTPUT_FILE = "Hydroelectric/Backend/dashboard_data.json"

def get_natural_inflow(month):
    """Reads the local CSV to get the constant inflow for the current month."""
    try:
        df = pd.read_csv('Hydroelectric/Backend/monthly_inflow.csv')
        inflow = df.loc[df['month'] == month, 'inflow_mwh_h'].values[0]
        return float(inflow)
    except Exception as e:
        print(f"Error reading hydrology data: {e}. Defaulting to 10 MWh.")
        return 10.0

def parse_entsoe_xml(content):
    """
    Parses ENTSO-E XML regardless of specific namespace version.
    Handles missing hours by forward-filling data.
    """
    try:
        root = ET.fromstring(content)
        
        # 1. Extract Namespace dynamically from the root tag
        # Root tag format: {namespace}TagName
        if '}' in root.tag:
            namespace_url = root.tag.split('}')[0].strip('{')
            ns = {'e': namespace_url} # 'e' is our alias for the namespace
        else:
            ns = {} # No namespace

        # 2. Find all Point elements
        # XPath: Find 'Point' anywhere in the tree
        points = root.findall(".//e:Point", ns)
        
        # 3. Extract Price and Position
        data_map = {}
        for p in points:
            pos = int(p.find("e:position", ns).text)
            price = float(p.find("e:price.amount", ns).text)
            data_map[pos] = price
            
        # 4. Construct clean 24-hour list
        # If an hour is missing (like pos 9 in your snippet), we use the previous hour's price
        clean_prices = []
        last_price = 0.0
        
        for hour_idx in range(1, 25): # ENTSO-E positions are 1-24
            if hour_idx in data_map:
                last_price = data_map[hour_idx]
            else:
                print(f"Warning: Missing data for hour {hour_idx}. Forward-filling.")
            clean_prices.append(last_price)
            
        return clean_prices

    except Exception as e:
        print(f"XML Parsing Error: {e}")
        return None

def fetch_prices():
    """
    Fetches Day-Ahead Prices from ENTSO-E.
    """
    if not ENTSOE_KEY:
        print("Warning: No ENTSOE_KEY found. Using Mock Data.")
        return get_mock_prices()

    # Time: Tomorrow 00:00 to 23:00 UTC
    now = dt.datetime.now(dt.timezone.utc)
    tomorrow = now + dt.timedelta(days=1)
    start_str = tomorrow.strftime("%Y%m%d0000")
    end_str = tomorrow.strftime("%Y%m%d2300")
    
    url = "https://web-api.tp.entsoe.eu/api"
    params = {
        "securityToken": ENTSOE_KEY,
        "documentType": "A44",  # Price Document
        "in_Domain": AREA_CODE,
        "out_Domain": AREA_CODE,
        "periodStart": start_str,
        "periodEnd": end_str
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        prices = parse_entsoe_xml(response.content)
        
        if not prices or len(prices) < 24:
            print("API returned invalid data. Using Mock.")
            return get_mock_prices()
            
        return prices

    except Exception as e:
        print(f"ENTSO-E Connection Error: {e}. Using Mock Data.")
        return get_mock_prices()

def get_mock_prices():
    """Generator for fallback data (Duck Curve)"""
    import random
    prices = []
    base_price = 80.0
    for hour in range(24):
        if 7 <= hour <= 10: price = base_price + random.uniform(20, 40)
        elif 18 <= hour <= 21: price = base_price + random.uniform(50, 80)
        elif 11 <= hour <= 16: price = base_price - random.uniform(10, 30)
        else: price = base_price - random.uniform(20, 40)
        prices.append(round(price, 2))
    return prices

def optimize_schedule():
    current_date = dt.datetime.now(dt.timezone.utc)
    month = current_date.month
    
    inflow_rate = get_natural_inflow(month)
    prices = fetch_prices()
    
    # Identify Strategy
    indexed_prices = [(p, h) for h, p in enumerate(prices)]
    indexed_prices.sort()
    
    buy_hours = [h for p, h in indexed_prices[:4]]
    sell_hours = [h for p, h in indexed_prices[-4:]]
    
    reservoir_level = INITIAL_LEVEL_MWH
    start_level = reservoir_level
    total_profit = 0.0
    history = []
    
    print(f"--- Simulation Start (Month: {month}) ---")
    
    for hour in range(24):
        price = prices[hour]
        action = "HOLD"
        cash_flow = 0.0
        
        if hour in buy_hours: planned = "PUMP"
        elif hour in sell_hours: planned = "TURBINE"
        else: planned = "HOLD"
            
        # Physics
        reservoir_level += inflow_rate
        
        if planned == "PUMP":
            space = MAX_CAPACITY_MWH - reservoir_level
            add = min(PUMP_POWER_MW * ROUND_TRIP_EFFICIENCY, space)
            if add > 0:
                reservoir_level += add
                cash_flow = -( (add / ROUND_TRIP_EFFICIENCY) * price )
                action = "PUMP"
            else: action = "SKIPPED_FULL"

        elif planned == "TURBINE":
            avail = reservoir_level
            release = min(TURBINE_POWER_MW, avail)
            if release > 0:
                reservoir_level -= release
                cash_flow = release * price
                action = "TURBINE"
            else: action = "SKIPPED_EMPTY"
        
        # Spillage Check
        if reservoir_level > MAX_CAPACITY_MWH:
            reservoir_level = MAX_CAPACITY_MWH
            if action == "HOLD": action = "SPILLAGE"
        
        total_profit += cash_flow
        
        history.append({
            "hour": f"{hour:02d}:00",
            "price": round(price, 2),
            "reservoir": round(reservoir_level, 2),
            "action": action
        })

    end_level = reservoir_level

    output = {
        "metadata": {
            "date": current_date.strftime("%Y-%m-%d %H:%M:%S"),
            "total_profit": round(total_profit, 2),
            "net_inflow_today": round(inflow_rate * 24, 2),
            "reservoir_start": start_level,
            "reservoir_end": end_level
        },
        "data": history
    }

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=4)
    
    print(f"Success. Profit: {total_profit} EUR.")

if __name__ == "__main__":
    optimize_schedule()