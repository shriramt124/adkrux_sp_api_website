"""
Marketplace and Endpoint mappings for Amazon SP-API.
"""

SP_API_ENDPOINTS = {
    "NA": "https://sellingpartnerapi-na.amazon.com",    # North America
    "EU": "https://sellingpartnerapi-eu.amazon.com",    # Europe / India
    "FE": "https://sellingpartnerapi-fe.amazon.com",    # Far East (Japan, Australia, SG)
}

# Map country codes (as seen in the Excel sheet) to their SP-API Marketplace ID 
# and corresponding Regional Endpoint.
# Add more countries as needed.
MARKETPLACE_MAP = {
    "US": {
        "marketplace_id": "ATVPDKIKX0DER",
        "endpoint": SP_API_ENDPOINTS["NA"],
        "language_tag": "en_US"
    },
    "CA": {
        "marketplace_id": "A2EUQ1WTGCTBG2",
        "endpoint": SP_API_ENDPOINTS["NA"],
        "language_tag": "en_CA"
    },
    "MX": {
        "marketplace_id": "A1AM78C64UM0Y8",
        "endpoint": SP_API_ENDPOINTS["NA"],
        "language_tag": "es_MX"
    },
    "UK": {
        "marketplace_id": "A1F83G8C2ARO7P",
        "endpoint": SP_API_ENDPOINTS["EU"],
        "language_tag": "en_GB"
    },
    "GB": { # Alternative format for UK
        "marketplace_id": "A1F83G8C2ARO7P",
        "endpoint": SP_API_ENDPOINTS["EU"],
        "language_tag": "en_GB"
    },
    "DE": {
        "marketplace_id": "A1PA6795UKMFR9",
        "endpoint": SP_API_ENDPOINTS["EU"],
        "language_tag": "de_DE"
    },
    "IN": {
        "marketplace_id": "A21TJRUUN4KGV",
        "endpoint": SP_API_ENDPOINTS["EU"],
        "language_tag": "en_IN"
    },
    "AE": {
        "marketplace_id": "A2VIGQ35RCS4UG",
        "endpoint": SP_API_ENDPOINTS["EU"],
        "language_tag": "en_AE"
    },
    "SA": {
        "marketplace_id": "A17E79C6D8DWNP",
        "endpoint": SP_API_ENDPOINTS["EU"],
        "language_tag": "ar_SA"
    },
    "AU": {
        "marketplace_id": "A39IBJ37TRP1C6",
        "endpoint": SP_API_ENDPOINTS["FE"],
        "language_tag": "en_AU"
    },
    "JP": {
        "marketplace_id": "A1VC38T7YXB528",
        "endpoint": SP_API_ENDPOINTS["FE"],
        "language_tag": "ja_JP"
    }
}
