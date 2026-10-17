-- "Vegetarian" is a dietary restriction, not a cuisine. Clear it from existing rows so they
-- fall back to untagged; re-running the tagger (npm run tag) gives them a real cuisine.
update public.restaurants set cuisine = null where cuisine = 'vegetarian';
