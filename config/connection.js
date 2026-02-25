const { MongoClient } = require('mongodb'); // Ensure correct import

const state = {
    db: null
};

module.exports.connect = async function (done) {
    try {
        const url = 'mongodb://127.0.0.1:27017'; // Use 127.0.0.1 instead of localhost
        const dbName = 'miniproject';

        console.log("Attempting to connect to MongoDB...");

        
        const client = new MongoClient(url);
        await client.connect(); // Establish connection
        state.db = client.db(dbName);
        console.log("Connected to MongoDB successfully");
        done();
    } catch (err) {
        console.error("MongoDB connection error:", err);
        done(err);
    }
};

module.exports.get = function () {
    if (!state.db) {
        throw new Error("Database not initialized. Call connect() first.");
    }
    return state.db;
};