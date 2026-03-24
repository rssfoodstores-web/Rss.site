drop policy if exists "Anyone can view product reviews" on public.product_reviews;

create policy "Anyone can view product reviews"
on public.product_reviews
for select
to public
using (true);
