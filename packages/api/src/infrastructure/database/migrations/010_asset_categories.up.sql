-- Replace the broad category list with the public asset taxonomy. Existing
-- rows with the canonical slugs are updated in place, preserving their IDs.
INSERT INTO categories (name, slug, description, is_active)
VALUES
    ('Property & Real Estate', 'property', 'Land, buildings, plots, offices, warehouses, and other real estate.', TRUE),
    ('Vehicles (Automobiles & SUVs)', 'vehicles', 'Passenger cars, SUVs, vans, and other light vehicles.', TRUE),
    ('Commercial Trucks & Logistics Fleet', 'commercial-trucks-logistics-fleet', 'Commercial trucks, buses, trailers, and logistics fleet vehicles.', TRUE),
    ('Heavy Construction Machinery', 'heavy-construction-machinery', 'Excavators, loaders, graders, cranes, and earthmoving machinery.', TRUE),
    ('Agricultural Equipment & Tractors', 'agricultural-equipment-tractors', 'Farm tractors, harvesters, implements, and agricultural equipment.', TRUE),
    ('Industrial Machinery & Plant Equipment', 'industrial-machinery-plant-equipment', 'Manufacturing machinery, generators, compressors, and plant equipment.', TRUE),
    ('Electronics & IT Infrastructure', 'electronics', 'Computers, network hardware, telecom equipment, and electronics.', TRUE),
    ('Office Furniture & Business Assets', 'office-furniture-business-assets', 'Office furniture, fixtures, and general business equipment.', TRUE),
    ('Scrap Metal & Raw Materials', 'scrap-metal-raw-materials', 'Scrap metal, recyclable materials, and surplus raw materials.', TRUE),
    ('General Merchandise & Miscellaneous', 'general', 'Other merchandise and assets that do not fit a specific category.', TRUE)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = TRUE,
    updated_at = NOW();

-- Reclassify existing lots using their own text plus the old category metadata.
-- Specific vehicle and equipment types are checked before broad legacy terms.
DO $$
DECLARE
    lot RECORD;
    target_slug TEXT;
BEGIN
    FOR lot IN
        SELECT ai.id,
               LOWER(CONCAT_WS(' ', ai.title, ai.description)) AS item_text,
               LOWER(CONCAT_WS(' ', c.name, c.slug, c.description)) AS category_text
        FROM auction_items ai
        LEFT JOIN categories c ON c.id = ai.category_id
        WHERE ai.category_id IS NOT NULL
    LOOP
        target_slug := CASE
            WHEN lot.item_text ~ '(real estate|property|building|warehouse|land|plot|premise|office space)' THEN 'property'
            WHEN lot.item_text ~ '(farm|agricultur|harvest|plough|cultivat|irrigat|seed drill|combine harvester|tractor)' THEN 'agricultural-equipment-tractors'
            WHEN lot.item_text ~ '(truck|lorry|bus|trailer|fleet|logistic|cargo|transport|tipper|tractor unit)' THEN 'commercial-trucks-logistics-fleet'
            WHEN lot.item_text ~ '(excavator|bulldozer|grader|wheel loader|backhoe|crane|earthmov|construction machinery|caterpillar)' THEN 'heavy-construction-machinery'
            WHEN lot.item_text ~ '(generator|compressor|lathe|industrial|manufactur|plant equipment|production line)' THEN 'industrial-machinery-plant-equipment'
            WHEN lot.item_text ~ '(computer|laptop|server|network|telecom|electronic|printer|phone|it infrastructure)' THEN 'electronics'
            WHEN lot.item_text ~ '(furniture|desk|chair|cabinet|office equipment|business asset)' THEN 'office-furniture-business-assets'
            WHEN lot.item_text ~ '(scrap|raw material|recycl|metal|steel|copper|aluminium|aluminum)' THEN 'scrap-metal-raw-materials'
            WHEN lot.item_text ~ '(vehicle|automobile|car|suv|van|sedan|pickup)' THEN 'vehicles'
            WHEN lot.item_text ~ '(machinery|equipment|machine)' THEN 'industrial-machinery-plant-equipment'
            WHEN lot.category_text ~ '(property|real estate|land)' THEN 'property'
            WHEN lot.category_text ~ '(agricultur|farm|tractor|harvest)' THEN 'agricultural-equipment-tractors'
            WHEN lot.category_text ~ '(truck|lorry|bus|fleet|transport|logistic)' THEN 'commercial-trucks-logistics-fleet'
            WHEN lot.category_text ~ '(construction|earthmov|excavat|heavy equipment)' THEN 'heavy-construction-machinery'
            WHEN lot.category_text ~ '(electronic|computer|it infrastructure)' THEN 'electronics'
            WHEN lot.category_text ~ '(furniture|office)' THEN 'office-furniture-business-assets'
            WHEN lot.category_text ~ '(scrap|raw material|metal)' THEN 'scrap-metal-raw-materials'
            WHEN lot.category_text ~ '(vehicle|automobile|car|suv)' THEN 'vehicles'
            WHEN lot.category_text ~ '(machinery|industrial|equipment|machine)' THEN 'industrial-machinery-plant-equipment'
            ELSE 'general'
        END;

        UPDATE auction_items
        SET category_id = (SELECT id FROM categories WHERE slug = target_slug),
            updated_at = NOW()
        WHERE id = lot.id;
    END LOOP;
END $$;

-- Retain legacy rows for references and audit history, but keep duplicate and
-- obsolete names out of the active taxonomy exposed to users.
UPDATE categories
SET is_active = FALSE,
    updated_at = NOW()
WHERE slug NOT IN (
    'property',
    'vehicles',
    'commercial-trucks-logistics-fleet',
    'heavy-construction-machinery',
    'agricultural-equipment-tractors',
    'industrial-machinery-plant-equipment',
    'electronics',
    'office-furniture-business-assets',
    'scrap-metal-raw-materials',
    'general'
);

-- Prevent future category rows from creating duplicate choices in the UI.
CREATE UNIQUE INDEX IF NOT EXISTS categories_active_name_unique
    ON categories (LOWER(name))
    WHERE is_active = TRUE;
