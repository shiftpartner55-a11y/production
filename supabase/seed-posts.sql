-- Optional: three starter articles so the blog is not empty on launch.
-- Run after schema.sql. Edit or delete them any time from the admin dashboard.
insert into public.blog_posts (title, slug, excerpt, content, featured_image, image_alt, category_id, author, status, seo_title, meta_description, focus_keyword, published_at)
values
(
  'How to Pack Your Home for a Safe and Stress-Free Move',
  'how-to-pack-your-home-for-moving',
  'A room-by-room packing plan — from essentials boxes to fragile kitchenware — that keeps your household move organised and your belongings protected.',
  $$<p>Packing is the part of a house move that takes the most time — and the part that most affects how your belongings arrive. A clear plan makes moving day calmer and unpacking much faster.</p>
<h2>1. Start with a declutter</h2>
<p>Every item you don't move is one less item to pack, load and unpack. Two to three weeks before your move, go room by room and set aside things to donate, sell or discard.</p>
<h2>2. Gather the right packing materials</h2>
<ul><li>Sturdy boxes in small, medium and large sizes</li><li>Bubble wrap and packing paper for fragile items</li><li>Stretch film and furniture covers</li><li>Strong packing tape and marker pens</li></ul>
<p>Use small boxes for heavy items such as books, and large boxes for light items such as bedding.</p>
<h2>3. Pack room by room</h2>
<p>Start with rooms you use least — store rooms, guest rooms and showcases — and finish with the kitchen and bedrooms. Label every box with its <strong>room</strong> and a short <strong>contents list</strong>.</p>
<blockquote><p>Tip: number your boxes and keep a simple list on your phone. It makes checking deliveries quick and easy.</p></blockquote>
<h2>4. Give fragile items extra care</h2>
<p>Wrap glasses, plates and showpieces individually. Plates travel better standing on edge, like records. Fill empty spaces with paper so nothing moves inside the box, and mark these boxes clearly as <em>Fragile</em>.</p>
<h2>5. Prepare an essentials box</h2>
<p>Pack a bag or box you'll keep with you: documents, chargers, medicines, a change of clothes, basic toiletries, snacks and a few utensils. It saves you from searching through boxes on the first night.</p>
<h2>6. Let professionals handle the heavy lifting</h2>
<p>Large furniture, appliances and delicate items benefit from professional packing and handling. Shiftingpartner plans packing according to the nature, size and handling requirements of your belongings.</p>
<table><thead><tr><th>When</th><th>What to do</th></tr></thead><tbody><tr><td>3 weeks before</td><td>Declutter and book your movers</td></tr><tr><td>2 weeks before</td><td>Collect packing materials, start packing rarely used rooms</td></tr><tr><td>1 week before</td><td>Pack most rooms, confirm society permissions</td></tr><tr><td>Moving day</td><td>Keep your essentials box with you and check the box list</td></tr></tbody></table>$$,
  'https://images.unsplash.com/photo-1773625706534-4cfa0e74f229?auto=format&fit=crop&w=1600&q=72',
  'Packed cardboard moving boxes stacked near a window',
  (select id from public.blog_categories where slug = 'packing-guides'),
  'Shiftingpartner Team', 'published',
  'How to Pack Your Home for Moving: Room-by-Room Guide',
  'A practical room-by-room packing guide for a safe, stress-free household move — materials, fragile items, labelling and an essentials box checklist.',
  'how to pack your home for moving',
  now() - interval '6 days'
),
(
  'A Complete Guide to House Shifting in Bengaluru',
  'house-shifting-guide-bengaluru',
  'Apartment association rules, traffic timing and monsoon showers — what to plan for when you move home within or out of Bengaluru.',
  $$<p>Bengaluru is one of India's busiest cities for household moves. Whether you are shifting from Whitefield to Sarjapur Road or relocating to another city, a little local planning goes a long way.</p>
<h2>Check your apartment association's rules</h2>
<p>Many communities require a move-out or move-in permission, allow moves only at certain hours and ask you to book the service lift. Speak to your association early and share the rules with your movers.</p>
<h2>Plan around traffic</h2>
<p>Outer Ring Road, Silk Board and Hebbal can add hours to a move during peak times. Early loading slots usually make the day more predictable.</p>
<h2>Prepare for rain</h2>
<p>Sudden evening showers are common, especially in the monsoon months. Make sure mattresses, sofas and electronics are wrapped before they leave the house.</p>
<h2>Moving out of Bengaluru?</h2>
<p>For intercity moves — to Hyderabad, Chennai, Pune, Mumbai, Coimbatore or Delhi — share your destination early so route availability and delivery timelines can be confirmed.</p>
<p>Read more on our <a href="/cities/bengaluru.html">Bengaluru house shifting page</a>, or <a href="/consultation.html">request a free consultation</a>.</p>$$,
  'https://images.unsplash.com/photo-1687158267365-3584c7966bc4?auto=format&fit=crop&w=1600&q=72',
  'Bengaluru skyline with tall buildings under a cloudy sky',
  (select id from public.blog_categories where slug = 'city-guides'),
  'Shiftingpartner Team', 'published',
  'House Shifting in Bengaluru: A Complete Local Guide',
  'Planning a house move in Bengaluru? Society rules, traffic timing, monsoon packing and intercity relocation tips from Shiftingpartner.',
  'house shifting in bengaluru',
  now() - interval '13 days'
),
(
  'Essential Packing Materials for a Household Move',
  'essential-packing-materials-household-move',
  'The packing materials that matter most for a household move — and which belongings need which kind of protection.',
  $$<p>The right packing materials protect your belongings from scratches, knocks and moisture. Here is what a typical household move needs.</p>
<h2>Corrugated boxes</h2><p>Use strong boxes in a few standard sizes. Heavier items go in smaller boxes so they stay easy to lift.</p>
<h2>Bubble wrap and packing paper</h2><p>Ideal for glassware, crockery, showpieces and photo frames. Wrap each item individually.</p>
<h2>Stretch film and furniture covers</h2><p>Protects sofas, mattresses and polished surfaces from dust, scratches and rain during loading.</p>
<h2>Foam sheets and corner guards</h2><p>Useful for mirrors, glass tabletops, televisions and furniture edges.</p>
<h2>Tape, labels and markers</h2><p>Good tape keeps boxes closed; clear labels make unloading and unpacking faster.</p>
<p>Shiftingpartner provides packing materials suited to your household belongings. <a href="/consultation.html">Get a free consultation</a> to plan yours.</p>$$,
  'https://images.unsplash.com/photo-1766040923580-16ad32fae8b4?auto=format&fit=crop&w=1600&q=72',
  'Pile of cardboard boxes sealed with blue packing tape',
  (select id from public.blog_categories where slug = 'packing-guides'),
  'Shiftingpartner Team', 'published',
  'Essential Packing Materials for a Household Move',
  'Boxes, bubble wrap, stretch film and more — the essential packing materials for a safe household move, and what each one protects.',
  'packing materials for house shifting',
  now() - interval '20 days'
)
on conflict (slug) do nothing;
