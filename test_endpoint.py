import sys
import json

from ocean_service import get_ocean_node, fetch_live_profile
from main import infer_basin

if __name__ == "__main__":
    lat = float(sys.argv[1]) if len(sys.argv) > 1 else 15.2
    lon = float(sys.argv[2]) if len(sys.argv) > 2 else 87.4

    print(f"Testing point: lat={lat}, lon={lon}")
    print("-" * 50)

    live = fetch_live_profile(lat, lon)
    if live is None:
        print("LIVE HYCOM/ERDDAP fetch FAILED — will use climatology fallback.")
        print("Check: internet access, or whether PacIOOS renamed the 'hycom_global' dataset.")
        print("Visit https://pae-paha.pacioos.hawaii.edu/erddap/griddap/hycom_global.html to check manually.")
    else:
        print("LIVE HYCOM/ERDDAP fetch SUCCEEDED.")

    print("-" * 50)
    basin = infer_basin(lat, lon)
    result = get_ocean_node(lat, lon, basin)
    print(json.dumps(result, indent=2))
