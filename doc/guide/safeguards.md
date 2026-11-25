# Community Safeguards

Two protections are on by default. Admins turn them off or tune them in **Admin → Settings → Safeguards**.

## Hateful words filter

Slurs (racist, antisemitic, homophobic, transphobic…) are masked with asterisks as soon as a message is posted, in:

- the shoutbox
- forum topics (title and content) and replies
- torrent comments

The built-in list covers English, French, German, Spanish and Italian. Words are compared after normalization, so `N1GG3R`, `niiigger` or accented variants are caught too. Matching is done word by word: a slur inside another word (`Niger`, `Scunthorpe`) is left alone.

Add your own words in the **Extra words** box, one per line. End a word with `*` to match every word starting with it (`slur*` also catches `slurs` and `slurring`). Without `*`, the word and its plural are matched.

Messages already posted are not changed when the filter or the list changes.

## Multi-account guard

An account that signs up or signs in from an IP address already used by another active account is **put on hold**. While on hold, it only sees an appeal page: the site, RSS feeds and the Torznab API are refused.

The member explains the situation (same household, flatmates, office) in an appeal. Staff review it in **Moderation → IP appeals**, where each held account shows its appeal and the other accounts seen on the same IP (the IP itself is not displayed):

- **Approve and exempt**: the hold is lifted and the account is never checked again.
- **Reject**: the account stays on hold. The member can send a new appeal. Ban it from the user page if it is a clear multi-account.

Rules:

- Staff accounts are never held.
- Banned or held accounts on the same IP do not count: the first account stays free while the second one is held.
- An exempt account does not put others on hold either.

::: tip Shared IPs
Mobile carriers (CGNAT), universities and some ISPs put many people behind one IP. If your members often share addresses, expect more appeals, or turn the guard off.
:::

::: warning Tracker
The hold applies to the website, feeds and Torznab. A held member who already has `.torrent` files can still announce with their passkey: ban the account to cut tracker access too.
:::
