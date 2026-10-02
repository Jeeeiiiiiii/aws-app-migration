# Cutover is a Route53 record change read by our own front door

Users reach the store through a front-door proxy that resolves its upstream from a
Route53 record via the API, rather than a hardcoded switch in the proxy. Real
cutovers are DNS changes, so the demo performs one; Floci's Route53 is API-only
(its DNS server isn't known to serve hosted-zone records), which is why the proxy
reads the record instead of doing a DNS lookup. It also leaves room for a weighted
canary later.
