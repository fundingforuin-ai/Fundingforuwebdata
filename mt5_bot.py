import time
import requests
import logging
import MetaTrader5 as mt5
from datetime import datetime

# --- Configuration ---
BACKEND_URL = "http://localhost:3000"
POLL_INTERVAL = 2  # 2 seconds
ADMIN_TOKEN = "Admin@123"  # In a production app, use a secure API key or env var

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_active_accounts():
    """Fetch active MT5 accounts from the dashboard backend."""
    try:
        # We simulate admin auth by just calling the API endpoint.
        # In the dashboard, this endpoint requires authMiddleware and adminOnly.
        # For a headless bot, the backend should ideally use an API key. 
        # Since we haven't built API Key auth, we will login as admin to get a JWT token.
        login_res = requests.post(f"{BACKEND_URL}/api/login", json={"email": "admin@fundings4u.com", "password": ADMIN_TOKEN})
        if login_res.status_code != 200:
            logging.error("Failed to authenticate bot with backend.")
            return []
        token = login_res.json().get('token')
        
        headers = {'Authorization': f'Bearer {token}'}
        res = requests.get(f"{BACKEND_URL}/api/bot/accounts", headers=headers)
        if res.status_code == 200:
            return res.json()
        else:
            logging.error(f"Failed to fetch accounts: {res.status_code} {res.text}")
    except Exception as e:
        logging.error(f"Error fetching accounts: {e}")
    return []

def push_metrics(account_id, metrics):
    """Push account balance, equity, and stats to the backend."""
    try:
        # Pushing metrics is unauthenticated in the current server.js route
        payload = {"trading_account_id": account_id, **metrics}
        res = requests.post(f"{BACKEND_URL}/api/metrics/push", json=payload)
        if res.status_code != 200:
            logging.error(f"Failed to push metrics for acc {account_id}: {res.text}")
    except Exception as e:
        logging.error(f"Error pushing metrics: {e}")

def push_trades(account_id, trades):
    """Push live/historical trades to the backend."""
    try:
        payload = {"trading_account_id": account_id, "trades": trades}
        res = requests.post(f"{BACKEND_URL}/api/trades/push", json=payload)
        if res.status_code != 200:
            logging.error(f"Failed to push trades for acc {account_id}: {res.text}")
    except Exception as e:
        logging.error(f"Error pushing trades: {e}")

def calculate_stats(history_deals):
    """Calculate win rate and trade counts from MT5 deal history."""
    if not history_deals:
        return {"win_rate": 0, "total_trades": 0, "winning_trades": 0, "losing_trades": 0, "profit": 0}
    
    total = 0
    wins = 0
    losses = 0
    total_profit = 0.0

    for deal in history_deals:
        # Only count closed deals (Entry Out) that affected profit
        if deal.entry == mt5.DEAL_ENTRY_OUT:
            total += 1
            total_profit += deal.profit
            if deal.profit > 0:
                wins += 1
            elif deal.profit < 0:
                losses += 1
                
    win_rate = (wins / total * 100) if total > 0 else 0
    return {
        "win_rate": round(win_rate, 2),
        "total_trades": total,
        "winning_trades": wins,
        "losing_trades": losses,
        "profit": round(total_profit, 2)
    }

def format_trades(open_positions, history_deals):
    """Format MT5 positions and deals into our DB schema format."""
    trades = []
    
    # Process open positions
    if open_positions:
        for pos in open_positions:
            trades.append({
                "ticket": str(pos.ticket),
                "symbol": pos.symbol,
                "type": "BUY" if pos.type == mt5.ORDER_TYPE_BUY else "SELL",
                "volume": pos.volume,
                "open_price": pos.price_open,
                "close_price": pos.price_current, # Live floating price
                "profit": pos.profit,
                "open_time": pos.time,
                "close_time": None
            })
            
    # Process closed deals (We reconstruct trades from deals)
    # Note: MT5 deals are complex. For a simple bot, we map DEAL_ENTRY_OUT as closed trades.
    if history_deals:
        for deal in history_deals:
            if deal.entry == mt5.DEAL_ENTRY_OUT:
                trades.append({
                    "ticket": str(deal.position_id),
                    "symbol": deal.symbol,
                    "type": "BUY" if deal.type == mt5.DEAL_TYPE_SELL else "SELL", # Out deal type is opposite of position
                    "volume": deal.volume,
                    "open_price": deal.price, # simplified
                    "close_price": deal.price,
                    "profit": deal.profit,
                    "open_time": deal.time, # We'd ideally link the IN deal time, but simplifying for MVP
                    "close_time": deal.time
                })
    return trades

def run_bot():
    logging.info("Starting Fundings4U MT5 Sync Bot...")
    
    # Initialize MT5
    if not mt5.initialize():
        logging.critical(f"MetaTrader5 initialization failed, error code: {mt5.last_error()}")
        return

    logging.info("MetaTrader5 Initialized successfully.")

    while True:
        try:
            accounts = get_active_accounts()
            
            for acc in accounts:
                acc_id = acc['trading_account_id']
                login = int(acc['mt5_login'])
                password = acc['mt5_password']
                server = acc['mt5_server']
                
                # Attempt to login to the specific account
                authorized = mt5.login(login, password=password, server=server)
                if not authorized:
                    logging.warning(f"Failed to login to account {login} on {server}: {mt5.last_error()}")
                    continue
                
                # Extract Account Info (Balance, Equity)
                account_info = mt5.account_info()
                if not account_info:
                    continue
                
                balance = account_info.balance
                equity = account_info.equity
                drawdown = account_info.margin_level if account_info.margin_level > 0 else 0.0

                # Extract History (From Jan 1, 2020 to Now)
                utc_from = datetime(2020, 1, 1)
                utc_to = datetime.now()
                deals = mt5.history_deals_get(utc_from, utc_to)
                positions = mt5.positions_get()
                
                # Calculate aggregated stats
                stats = calculate_stats(deals)
                
                metrics = {
                    "balance": balance,
                    "equity": equity,
                    "profit": stats['profit'],
                    "drawdown": round(drawdown, 2),
                    "win_rate": stats['win_rate'],
                    "total_trades": stats['total_trades'],
                    "winning_trades": stats['winning_trades'],
                    "losing_trades": stats['losing_trades']
                }
                
                # Push Metrics
                push_metrics(acc_id, metrics)
                
                # Extract and Push Trades
                trade_list = format_trades(positions, deals)
                if trade_list:
                    push_trades(acc_id, trade_list)
                    
                logging.info(f"Synced Account {login} | Eq: {equity} | Trades: {len(trade_list)}")

        except Exception as e:
            logging.error(f"Unexpected error in main loop: {e}")
            
        time.sleep(POLL_INTERVAL)

    mt5.shutdown()

if __name__ == "__main__":
    run_bot()
