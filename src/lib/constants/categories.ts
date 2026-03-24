export interface CategoryItem {
    name: string
    examples: string[]
    attributes: string[]
}

export interface CategoryGroup {
    name: string
    items: CategoryItem[]
}

export const PRODUCT_CATEGORIES: CategoryGroup[] = [
    {
        name: "Fresh Produce",
        items: [
            { name: "Vegetables", examples: ["Tomatoes", "Onions", "Peppers", "Carrots", "Cabbage", "Lettuce"], attributes: ["Fresh", "Perishable", "Local"] },
            { name: "Leafy Greens", examples: ["Spinach (Efo)", "Ugu", "Bitter Leaf", "Garden Egg Leaves"], attributes: ["Fresh", "Perishable", "Local"] },
            { name: "Fruits", examples: ["Bananas", "Plantain", "Mangoes", "Pineapples", "Pawpaw", "Oranges", "Avocados"], attributes: ["Fresh", "Perishable", "Seasonal"] }
        ]
    },
    {
        name: "Tubers & Staple Flours",
        items: [
            { name: "Tubers", examples: ["Yam", "Sweet Potatoes", "Irish Potatoes", "Cocoyam"], attributes: ["Fresh", "Bulk"] },
            { name: "Flours", examples: ["Garri", "Cassava Flour", "Yam Flour", "Plantain Flour"], attributes: ["Dry", "Shelf-stable"] }
        ]
    },
    {
        name: "Grains, Rice & Cereals",
        items: [
            { name: "Rice", examples: ["Local Rice (Ofada)", "Parboiled Rice", "White Rice"], attributes: ["Dry", "Staple"] },
            { name: "Cereals", examples: ["Oats", "Wheat Flour", "Semolina", "Maize"], attributes: ["Dry", "Shelf-stable"] }
        ]
    },
    {
        name: "Beans, Pulses & Legumes",
        items: [
            { name: "Legumes", examples: ["Cowpeas", "Black-eyed Beans", "Bambara Nut", "Lentils", "Chickpeas"], attributes: ["Dry", "Protein-rich"] }
        ]
    },
    {
        name: "Oils & Essentials",
        items: [
            { name: "Cooking Oils", examples: ["Palm Oil", "Groundnut Oil", "Vegetable Oil", "Coconut Oil"], attributes: ["Liquid", "Shelf-stable"] },
            { name: "Fats", examples: ["Margarine", "Ghee", "Shortening"], attributes: ["Refrigerated/Room Temp"] }
        ]
    },
    {
        name: "Spices & Condiments",
        items: [
            { name: "Spices", examples: ["Curry", "Thyme", "Nutmeg", "Ginger", "Garlic Powder", "Pepper"], attributes: ["Dry", "Aromatics"] },
            { name: "Local Condiments", examples: ["Ogiri", "Iru", "Pepper Pastes"], attributes: ["Fermented/Perishable"] }
        ]
    },
    {
        name: "Sauces & Pastes",
        items: [
            { name: "Cooking Sauces", examples: ["Tomato Paste", "Jollof Mix", "Pasta Sauces", "BBQ Sauces"], attributes: ["Bottled", "Shelf-stable"] }
        ]
    },
    {
        name: "Packaged Foods",
        items: [
            { name: "Canned Goods", examples: ["Canned Fish", "Corned Beef", "Canned Beans"], attributes: ["Shelf-stable"] },
            { name: "Instant Foods", examples: ["Instant Noodles", "Pasta", "Instant Soups"], attributes: ["Shelf-stable"] }
        ]
    },
    {
        name: "Dairy & Eggs",
        items: [
            { name: "Milk & Dairy", examples: ["Fresh Milk", "UHT Milk", "Powdered Milk", "Yoghurt", "Cheese"], attributes: ["Chilled/Packaged"] },
            { name: "Eggs", examples: ["Egg Trays"], attributes: ["Fragile", "Fresh"] }
        ]
    },
    {
        name: "Frozen Foods",
        items: [
            { name: "Proteins", examples: ["Frozen Chicken", "Frozen Fish", "Frozen Beef"], attributes: ["Frozen", "Cold Chain"] },
            { name: "Ready Meals", examples: ["Frozen Prepared Meals"], attributes: ["Frozen", "Cold Chain"] }
        ]
    },
    {
        name: "Meat & Seafood",
        items: [
            { name: "Fresh Proteins", examples: ["Fresh Chicken", "Beef Cuts", "Goat Meat", "Smoked Fish"], attributes: ["Fresh", "Perishable"] }
        ]
    },
    {
        name: "Bakery & Confectionery",
        items: [
            { name: "Baked Goods", examples: ["Bread", "Cakes", "Cookies", "Pastries"], attributes: ["Fresh/Packaged"] }
        ]
    },
    {
        name: "Snacks & Finger Foods",
        items: [
            { name: "Snacks", examples: ["Chin-chin", "Plantain Chips", "Potato Chips", "Nuts"], attributes: ["Packaged", "Shelf-stable"] }
        ]
    },
    {
        name: "Breakfast Foods",
        items: [
            { name: "Breakfast Cereals", examples: ["Cornflakes", "Muesli", "Porridge Mixes"], attributes: ["Shelf-stable"] }
        ]
    },
    {
        name: "Dried Fruits & Nuts",
        items: [
            { name: "Dried Goods", examples: ["Dates", "Raisins", "Cashews", "Almonds"], attributes: ["Dry", "Long Shelf-life"] }
        ]
    },
    {
        name: "Beverages",
        items: [
            { name: "Non-Alcoholic", examples: ["Bottled Water", "Juices", "Malt Drinks", "Soft Drinks", "Tea", "Coffee", "Milo", "Bournvita", "Ovaltine"], attributes: ["Bottled", "Packaged"] }
        ]
    },
    {
        name: "Alcoholic Beverages",
        items: [
            { name: "Alcohol", examples: ["Beer", "Wine", "Spirits"], attributes: ["Restricted", "Age-verified"] }
        ]
    },
    {
        name: "Baby Food",
        items: [
            { name: "Infant Products", examples: ["Baby Cereal", "Infant Formula", "Purees"], attributes: ["Regulated", "Packaged"] }
        ]
    },
    {
        name: "Health & Specialty Foods",
        items: [
            { name: "Supplements", examples: ["Protein Powder", "Meal Replacements"], attributes: ["Regulated", "Packaged"] }
        ]
    },
    {
        name: "Ready-to-Eat Meals",
        items: [
            { name: "Cooked Foods", examples: ["Packaged Suya", "RTE Jollof", "Meal Kits"], attributes: ["Perishable/Chilled"] }
        ]
    },
    {
        name: "Traditional Foods",
        items: [
            { name: "Local Foods", examples: ["Ogi", "Palm Wine", "Kpomo"], attributes: ["Varies", "Perishable"] }
        ]
    },
    {
        name: "Baking Ingredients",
        items: [
            { name: "Baking Essentials", examples: ["Yeast", "Baking Powder", "Sugar", "Salt", "Cocoa"], attributes: ["Dry", "Shelf-stable"] }
        ]
    },
    {
        name: "Wholesale Foods",
        items: [
            { name: "Bulk Items", examples: ["Bulk Rice", "Bulk Sugar", "Bulk Oil"], attributes: ["Bulk Packaging"] }
        ]
    },
    {
        name: "Special Collections",
        items: [
            { name: "Gift Hampers", examples: ["Gourmet Hampers", "Grocery Baskets"], attributes: ["Gift Items"] },
            { name: "Artisanal Foods", examples: ["Organic Produce", "Keto Foods", "Vegan Items"], attributes: ["Niche Category"] }
        ]
    }
]

export const getDbCategory = (uiCategory: string): "fresh_produce" | "tubers" | "grains" | "oils" | "spices" | "proteins" | "packaged" | "specialty" => {
    const mapping: Record<string, "fresh_produce" | "tubers" | "grains" | "oils" | "spices" | "proteins" | "packaged" | "specialty"> = {
        // Fresh Produce
        "Vegetables": "fresh_produce",
        "Leafy Greens": "fresh_produce",
        "Fruits": "fresh_produce",
        "Eggs": "fresh_produce",

        // Tubers
        "Tubers": "tubers",
        "Flours": "tubers",

        // Grains
        "Rice": "grains",
        "Cereals": "grains",
        "Legumes": "grains",

        // Oils
        "Cooking Oils": "oils",
        "Fats": "oils",

        // Spices
        "Spices": "spices",
        "Local Condiments": "spices",

        // Proteins
        "Fresh Proteins": "proteins",
        "Proteins": "proteins",

        // Specialty
        "Alcohol": "specialty",
        "Supplements": "specialty",
        "Gift Hampers": "specialty",
        "Artisanal Foods": "specialty",
        "Local Foods": "specialty",
    }

    return mapping[uiCategory] || "packaged"
}
