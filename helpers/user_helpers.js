const db = require('../config/connection');
const collection = require('../config/collection');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const NEARBY_RADIUS_KM = 15;
const geolib=require('geolib')


const saltRounds = 10;

module.exports = {
   getUserDashboardData:async (userId)=> {
    try {
      const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) });
  
      if (!user) throw new Error("User not found");
  
      const favorites = await db.get().collection(collection.STATION_COLLECTION)
        .find({ _id: { $in: (user.favorites || []).map(id => new ObjectId(id)) } })
        .toArray();
  
      const reservations = await db.get().collection(collection.RESERVATION_COLLECTION)
        .find({ userId: new ObjectId(userId) })
        .toArray();
  
      const now = new Date();
      const upcoming = reservations.filter(r => new Date(r.date) > now);
      const past = reservations.filter(r => new Date(r.date) <= now);
  
      const usage = {
        kwh: past.reduce((sum, r) => sum + (r.kwhUsed || 0), 0),
        sessions: past.length,
        amount: past.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
      };
  
      const tips = [
        "Keep your vehicle charged above 20% before long drives.",
        "Check station status before heading out.",
        "Avoid peak hours to reduce waiting time."
      ];
  
      return {
        favorites,
        reservations: { upcoming, past },
        usage,
        tips
      };
    } catch (error) {
      console.error("Error in getUserDashboardData:", error);
      throw error;
    }
  },
  
  // Find Nearby Stations based on user location
  findNearbyStations : async(lat, lng)=> {
    try {
      const stations = await db.get().collection(collection.STATION_COLLECTION).find({ status: 'active' }).toArray();
  
      const nearby = stations.map(station => {
        const coords = station.coordinates?.coordinates; // [lng, lat]
        if (!coords || coords.length < 2) return null;
  
        const distance = geolib.getDistance(
          { latitude: lat, longitude: lng },
          { latitude: coords[1], longitude: coords[0] }
        );
  
        return {
          _id: station._id,
          name: station.name,
          location: station.location,
          coordinates: coords,
          distance: distance / 1000 // in kilometers
        };
      }).filter(Boolean).sort((a, b) => a.distance - b.distance);
  
      return nearby.slice(0, 10); // Limit to 10 closest
    } catch (error) {
      console.error("Error in findNearbyStations:", error);
      throw error;
    }
  },

  verifyLogin: async (email, password) => {
    const user = await db.get().collection(collection.USER_COLLECTION).findOne({ email });
    if (user && user.status !== 'blocked') {
      const match = await bcrypt.compare(password, user.password);
      if (match) return user;
    }
    return null;
  },

  getNearbyStations: async (lat, lng) => {
    return await db.get().collection(collection.STATION_COLLECTION).find({
      coordinates: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          $maxDistance: NEARBY_RADIUS_KM * 1000 // meters
        }
      },
      status: "active"
    }).toArray();
  },

  // Search stations by name or location
  searchStations: async (query) => {
    const regex = new RegExp(query, 'i');
    return await db.get().collection(collection.STATION_COLLECTION).find({
      $or: [
        { name: regex },
        { location: regex }
      ],
      status: "active"
    }).toArray();
  },

   getReservationsByStation :async(stationId, date = null)=> {
    const filter = {
      stationId: new ObjectId(stationId),
      date: date ? date : { $gte: new Date().toISOString().split('T')[0] }
    };
    return await db.get().collection(collection.RESERVATION_COLLECTION).find(filter).toArray();
  },

  getStationByIdWithUpdatedSlots: async (stationId) => {
    const station = await db.get().collection(collection.STATION_COLLECTION).findOne({ _id: new ObjectId(stationId) });
  
    const currentDateTime = new Date();
  
    // Only consider future or ongoing reservations for slot calculation
    const validReservations = await db.get().collection(collection.RESERVATION_COLLECTION).find({
      stationId: new ObjectId(stationId),
      $expr: {
        $gt: [
          {
            $dateFromString: {
              dateString: { $concat: ["$date", "T", "$endTime"] }
            }
          },
          currentDateTime
        ]
      }
    }).toArray();
  
    station.availableSlots = station.slots - validReservations.length;
    return station;
  },
  
  
   createReservation : async(data)=> {
    const { userId, stationId, date, startTime, endTime } = data;
  
    const now = new Date();
    const reservationStart = new Date(`${date}T${startTime}`);
    const reservationEnd = new Date(`${date}T${endTime}`);
  
    if (reservationStart < now || reservationEnd <= reservationStart) {
      return { success: false, error: "Invalid or past date/time selected." };
    }
  
    const overlapping = await db.get().collection(collection.RESERVATION_COLLECTION).findOne({
      stationId:new ObjectId(stationId),
      date,
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
      ]
    });
  
    if (overlapping) {
      return { success: false, error: "Slot already booked for selected time." };
    }
  
    await db.get().collection(collection.RESERVATION_COLLECTION).insertOne({
      userId:new ObjectId(userId),
      stationId:new ObjectId(stationId),
      date,
      startTime,
      endTime,
      status: 'reserved'
    });
  
    return { success: true };
  },

  getUserById: async (userId) => {
    return await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) });
  },

  updateUserProfile: async (userId, updatedData) => {
    return await db.get().collection(collection.USER_COLLECTION).updateOne(
      { _id: new ObjectId(userId) },
      { $set: updatedData }
    );
  },

  registerUser: async (userData) => {
    try {
      const { name, email, phone, password } = userData;

      // Basic validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[6-9]\d{9}$/;

      if (!emailRegex.test(email)) {
        return { success: false, message: 'Invalid email format.' };
      }

      if (!phoneRegex.test(phone)) {
        return { success: false, message: 'Invalid phone number.' };
      }

      // Check if user already exists
      const existingUser = await db
        .get()
        .collection(collection.USER_COLLECTION)
        .findOne({ $or: [{ email }, { phone }] });

      if (existingUser) {
        return { success: false, message: 'Email or phone already registered.' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const userObj = {
        name,
        email,
        phone,
        password: hashedPassword,
        createdAt: new Date(),
        status: 'active', // useful for blocking later
      };

      await db.get().collection(collection.USER_COLLECTION).insertOne(userObj);

      return { success: true };
    } catch (err) {
      console.error('Signup error:', err);
      return { success: false, message: 'Internal server error.' };
    }
  }
};
