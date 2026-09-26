revoke all on function public.match_watchlist_names(text, real, integer) from public, anon;
grant execute on function public.match_watchlist_names(text, real, integer) to authenticated, service_role;