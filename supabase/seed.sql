-- OrderIt sample data: 3 menus, 12 categories, 72 products.
-- Run in Supabase SQL Editor after setup.sql.
-- Sample prices are EUR. No users or orders are created.
-- Existing menus with the same name are skipped entirely on rerun.
-- An existing active menu remains active. Images can be added in Menu Builder.
begin;
lock table public.menus in share row exclusive mode;

do $$
declare
  v_menu integer;
  v_category integer;
begin
  if not exists (select 1 from public.menus where name = 'Winter''s Menu') then
    insert into public.menus(name, description)
    values ('Winter''s Menu', 'Comforting seasonal dishes, warming drinks and homemade desserts.') returning id into v_menu;
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Starters & Soups', 0) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Roasted Pumpkin Soup', 'Pumpkin, ginger, cream and toasted seeds.', 6.50, true, 0),
      (v_category, 'Chicken Soup', 'Chicken, rice, carrots and lemon.', 7.00, true, 1),
      (v_category, 'Mushroom Soup', 'Mixed mushrooms, thyme and cream.', 7.50, true, 2),
      (v_category, 'Baked Feta', 'Feta, honey, sesame and warm pita.', 8.00, true, 3),
      (v_category, 'Garlic Bread', 'Toasted sourdough with garlic butter.', 4.50, true, 4),
      (v_category, 'Spinach Pie', 'Filo pastry with spinach, feta and herbs.', 6.00, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Main Dishes', 1) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Beef Stew', 'Slow-cooked beef with carrots and mashed potatoes.', 16.50, true, 0),
      (v_category, 'Chicken in Mushroom Sauce', 'Grilled chicken, creamy mushrooms and rice.', 14.00, true, 1),
      (v_category, 'Traditional Moussaka', 'Layers of aubergine, minced beef and bechamel.', 13.50, true, 2),
      (v_category, 'Mushroom Risotto', 'Arborio rice, mushrooms and parmesan.', 12.50, true, 3),
      (v_category, 'Pork Souvlaki Plate', 'Pork skewers, pita, fries and tzatziki.', 13.00, true, 4),
      (v_category, 'Roasted Vegetable Bowl', 'Roasted roots, chickpeas and tahini dressing.', 11.00, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Hot Drinks', 2) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Espresso', 'A single shot of espresso.', 2.50, true, 0),
      (v_category, 'Double Cappuccino', 'Double espresso with steamed milk and foam.', 4.00, true, 1),
      (v_category, 'Greek Coffee', 'Traditional finely ground coffee.', 2.50, true, 2),
      (v_category, 'Hot Chocolate', 'Rich chocolate with steamed milk.', 4.50, true, 3),
      (v_category, 'Mountain Tea', 'Greek mountain tea with honey on the side.', 3.50, true, 4),
      (v_category, 'Chai Latte', 'Spiced black tea with steamed milk.', 4.50, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Desserts', 3) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Warm Apple Pie', 'Apple and cinnamon pastry with vanilla ice cream.', 6.50, true, 0),
      (v_category, 'Chocolate Souffle', 'Warm chocolate cake with a soft centre.', 7.00, true, 1),
      (v_category, 'Baklava', 'Filo layers, nuts and honey syrup.', 5.50, true, 2),
      (v_category, 'Rice Pudding', 'Creamy rice pudding with cinnamon.', 4.00, true, 3),
      (v_category, 'Orange Cake', 'Greek orange syrup cake.', 5.50, true, 4),
      (v_category, 'Cheesecake', 'Vanilla cheesecake with berry sauce.', 6.00, true, 5);
  end if;

  if not exists (select 1 from public.menus where name = 'Summer''s Menu') then
    insert into public.menus(name, description)
    values ('Summer''s Menu', 'Fresh salads, grilled favourites, iced coffees and refreshing drinks.') returning id into v_menu;
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Fresh Salads & Starters', 0) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Greek Salad', 'Tomato, cucumber, olives, onion, feta and oregano.', 9.00, true, 0),
      (v_category, 'Watermelon & Feta Salad', 'Watermelon, feta, mint and lime.', 8.50, true, 1),
      (v_category, 'Caesar Salad', 'Romaine, chicken, croutons and parmesan.', 10.50, true, 2),
      (v_category, 'Dakos', 'Barley rusk, grated tomato, feta and olive oil.', 7.50, true, 3),
      (v_category, 'Tzatziki & Pita', 'Greek yoghurt, cucumber, garlic and warm pita.', 5.00, true, 4),
      (v_category, 'Tomato Bruschetta', 'Toasted bread with tomato and basil.', 6.00, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Grill & Seafood', 1) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Grilled Sea Bream', 'Whole sea bream with greens and lemon.', 19.00, true, 0),
      (v_category, 'Grilled Octopus', 'Octopus with fava puree and capers.', 18.00, true, 1),
      (v_category, 'Chicken Souvlaki', 'Chicken skewers, pita, fries and tzatziki.', 12.50, true, 2),
      (v_category, 'Shrimp Linguine', 'Linguine with shrimp, tomato and garlic.', 16.00, true, 3),
      (v_category, 'Beef Burger', 'Beef patty, cheddar, tomato and fries.', 12.00, true, 4),
      (v_category, 'Grilled Halloumi Plate', 'Halloumi, grilled vegetables and pita.', 11.50, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Cold Drinks & Juices', 2) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Freddo Espresso', 'Double espresso shaken over ice.', 3.50, true, 0),
      (v_category, 'Freddo Cappuccino', 'Iced espresso topped with cold milk foam.', 4.00, true, 1),
      (v_category, 'Greek Frappe', 'Shaken iced instant coffee.', 3.00, true, 2),
      (v_category, 'Fresh Orange Juice', 'Freshly squeezed oranges.', 4.50, true, 3),
      (v_category, 'Homemade Lemonade', 'Lemon juice, sparkling water and mint.', 4.00, true, 4),
      (v_category, 'Peach Iced Tea', 'Chilled black tea with peach.', 4.00, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Ice Cream & Desserts', 3) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Vanilla Ice Cream', 'Two scoops of vanilla ice cream.', 4.50, true, 0),
      (v_category, 'Chocolate Ice Cream', 'Two scoops of chocolate ice cream.', 4.50, true, 1),
      (v_category, 'Lemon Sorbet', 'Two scoops of refreshing lemon sorbet.', 4.50, true, 2),
      (v_category, 'Fresh Fruit Plate', 'A selection of seasonal summer fruit.', 6.00, true, 3),
      (v_category, 'Yoghurt with Honey', 'Greek yoghurt, honey and walnuts.', 5.00, true, 4),
      (v_category, 'Affogato', 'Vanilla ice cream topped with hot espresso.', 5.50, true, 5);
  end if;

  if not exists (select 1 from public.menus where name = 'All-Day Cafe Menu') then
    insert into public.menus(name, description)
    values ('All-Day Cafe Menu', 'Breakfast, brunch, sandwiches and drinks served throughout the day.') returning id into v_menu;
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Breakfast & Brunch', 0) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Classic Breakfast', 'Eggs, bacon, sausage, grilled tomato and toast.', 10.00, true, 0),
      (v_category, 'Avocado Toast', 'Sourdough with avocado, cherry tomatoes and lemon.', 8.50, true, 1),
      (v_category, 'Eggs Benedict', 'Poached eggs, ham and hollandaise on toasted bread.', 10.50, true, 2),
      (v_category, 'Pancakes with Maple Syrup', 'Fluffy pancakes with maple syrup and butter.', 7.50, true, 3),
      (v_category, 'Chocolate Pancakes', 'Pancakes with chocolate sauce and banana.', 8.50, true, 4),
      (v_category, 'Granola Bowl', 'Greek yoghurt, granola, honey and seasonal fruit.', 6.50, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Sandwiches & Snacks', 1) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Club Sandwich', 'Chicken, bacon, lettuce, tomato and fries.', 9.50, true, 0),
      (v_category, 'Turkey & Cheese Toast', 'Toasted bread with turkey and gouda.', 4.50, true, 1),
      (v_category, 'Caprese Sandwich', 'Mozzarella, tomato, basil and pesto.', 7.00, true, 2),
      (v_category, 'Chicken Wrap', 'Grilled chicken, salad and yoghurt sauce.', 7.50, true, 3),
      (v_category, 'Falafel Wrap', 'Falafel, hummus, tomato and greens.', 7.00, true, 4),
      (v_category, 'French Fries', 'Golden fries with oregano and sea salt.', 4.00, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Coffee & Beverages', 2) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Americano', 'Espresso with hot water.', 3.00, true, 0),
      (v_category, 'Flat White', 'Double espresso with silky steamed milk.', 4.00, true, 1),
      (v_category, 'Latte', 'Espresso with steamed milk.', 4.00, true, 2),
      (v_category, 'Iced Latte', 'Espresso with cold milk and ice.', 4.00, true, 3),
      (v_category, 'Matcha Latte', 'Matcha green tea with steamed milk.', 4.50, true, 4),
      (v_category, 'Bottled Water 500ml', 'Still mineral water.', 0.50, true, 5);
    insert into public.categories("menuId", name, "sortOrder")
    values (v_menu, 'Bakery & Sweet Treats', 3) returning id into v_category;
    insert into public.products("categoryId", name, description, price, "isAvailable", "sortOrder") values
      (v_category, 'Butter Croissant', 'Freshly baked butter croissant.', 3.00, true, 0),
      (v_category, 'Chocolate Croissant', 'Croissant filled with chocolate.', 3.50, true, 1),
      (v_category, 'Blueberry Muffin', 'Soft muffin with blueberries.', 3.50, true, 2),
      (v_category, 'Banana Bread', 'A slice of banana bread with walnuts.', 4.00, true, 3),
      (v_category, 'Chocolate Brownie', 'Chocolate brownie with chocolate chunks.', 4.50, true, 4),
      (v_category, 'Carrot Cake', 'Spiced carrot cake with cream cheese frosting.', 5.50, true, 5);
  end if;

  -- Activate the winter menu only when no other menu is active.
  if not exists (select 1 from public.menus where "isActive") then
    update public.menus set "isActive" = true
    where id = (select id from public.menus where name = 'Winter''s Menu' order by id limit 1);
  end if;
end;
$$;

commit;

-- Review the resulting menus and counts.
select m.id, m.name, m."isActive",
  count(distinct c.id) as categories, count(p.id) as products
from public.menus m
left join public.categories c on c."menuId" = m.id
left join public.products p on p."categoryId" = c.id
group by m.id, m.name, m."isActive"
order by m.id;
