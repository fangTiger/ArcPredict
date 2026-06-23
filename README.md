# ArcPredict

ArcPredict is a prediction-market prototype with Crypto price markets and an event-market extension for World Cup scenarios. Crypto markets use `PredictionMarket` with Pyth-driven settlement; World Cup markets use `EventMarket` plus `AdminEventOracle` with a 72h dispute window. The frontend can hide World Cup with `NEXT_PUBLIC_WORLDCUP_ENABLED=false`, and score display can override TheSportsDB through `SPORTSDB_API_BASE` / `NEXT_PUBLIC_SPORTSDB_API_BASE`. See `docs/worldcup-category-runbook.md` and `web/README.md` for operating details.
