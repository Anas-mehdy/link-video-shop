# Postpurchase stock verification

Apply `crm-postpurchase-stock.sql` once in the Link Store Supabase project. No credentials or new environment variables are required. Do not apply to an unrelated project.

In the postpurchase dashboard select an offer and click the stock button. The server derives the complementary product IDs from that order, deduplicates them, and checks at most two product-detail requests per HTTP step. The UI continues sequentially, to a maximum of 60 unique products per run. It stops on provider failure or budget exhaustion. No customer messages are sent.

Product-level results are shared across all customers for four hours. Variants, quantities and option-value IDs are saved; a product with variants is only available when at least one variant has positive or unlimited quantity and Salla reports sale/available. Branch-managed stock is blocked for review. The native cart still checks the customer's selected variant at purchase time.

Every attempted provider request reserves one budget unit before network IO in a SQL transaction. A lease prevents concurrent requests for the same product. Failed requests are also counted and cached as unavailable/error for 15 minutes before a retry can be requested. A missing SQL schema blocks provider access. The monthly ceiling is the smaller of the stored budget and 700, measured in Asia/Riyadh calendar months. This counter concerns this feature only; it does not measure other app requests against Salla's overall 10,000 allowance.

Public personalized pages use saved results to hide checked-unavailable/error/checking products and update prices for fresh results. Opening those pages performs no Salla API call. Before the SQL is applied the existing page continues with the saved catalog.

This implements the stock service and a manual verification control. The minute worker is unchanged. Automatic pre-batch invocation and a strict fresh-stock send gate are to be wired into the subsequent production sender; no production after-sales campaign is enabled here.
