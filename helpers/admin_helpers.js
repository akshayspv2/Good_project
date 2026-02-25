const db = require('../config/connection');
const { ObjectId } = require('mongodb');
const collection = require('../config/collection');
const bcrypt = require('bcrypt')
const moment = require('moment');

module.exports = {
  /*getDashboardStats: async () => {
    const totalUsers = await db.get().collection(collection.USER_COLLECTION).countDocuments();
    const totalStations = await db.get().collection(collection.STATION_COLLECTION).countDocuments();
    const totalReservations = await db.get().collection(collection.RESERVATION_COLLECTION).countDocuments();

    const recentUsers = await db.get().collection(collection.USER_COLLECTION)
      .find().sort({ createdAt: -1 }).limit(10).toArray();

    const recentReservations = await db.get().collection(collection.RESERVATION_COLLECTION)
      .find().sort({ date: -1 }).limit(10).toArray();

    // Replace these with actual chart data logic
    const userChartLabels = ['Jan', 'Feb', 'Mar'];
    const userChartData = [10, 20, 30];

    const reservationChartLabels = ['Jan', 'Feb', 'Mar'];
    const reservationChartData = [5, 15, 25];

    return {
      totalUsers,
      totalStations,
      totalReservations,
      recentUsers,
      recentReservations,
      userChartLabels: JSON.stringify(userChartLabels),
      userChartData: JSON.stringify(userChartData),
      reservationChartLabels: JSON.stringify(reservationChartLabels),
      reservationChartData: JSON.stringify(reservationChartData)
    };
  },*/

  getDashboardStats: async () => {
    const dbInstance = db.get();

    const totalUsers = await dbInstance.collection(collection.USER_COLLECTION).countDocuments();
    const totalStations = await dbInstance.collection(collection.STATION_COLLECTION).countDocuments();
    const totalReservations = await dbInstance.collection(collection.RESERVATION_COLLECTION).countDocuments();

    const recentUsers = await dbInstance.collection(collection.USER_COLLECTION)
      .find().sort({ createdAt: -1 }).limit(10).toArray();

    const recentReservations = await dbInstance.collection(collection.RESERVATION_COLLECTION)
      .find().sort({ date: -1 }).limit(10).toArray();

    // Generate labels for past 6 months
    const labels = Array.from({ length: 6 }).map((_, i) =>
      moment().subtract(5 - i, 'months').format('MMM YYYY')
    );

    // USER Chart Data
    const userStats = await dbInstance.collection(collection.USER_COLLECTION).aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const userChartData = labels.map(label => {
      const stat = userStats.find(stat =>
        moment(`${stat._id.month}-01-${stat._id.year}`, 'M-DD-YYYY').format('MMM YYYY') === label
      );
      return stat ? stat.count : 0;
    });

    // RESERVATION Chart Data (Coerce string dates to Date)
    const reservationStats = await dbInstance.collection(collection.RESERVATION_COLLECTION).aggregate([
      {
        $addFields: {
          reservationDate: { $toDate: "$date" }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$reservationDate" },
            month: { $month: "$reservationDate" }
          },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const reservationChartData = labels.map(label => {
      const stat = reservationStats.find(stat =>
        moment(`${stat._id.month}-01-${stat._id.year}`, 'M-DD-YYYY').format('MMM YYYY') === label
      );
      return stat ? stat.count : 0;
    });

    return {
      totalUsers,
      totalStations,
      totalReservations,
      recentUsers,
      recentReservations,
      userChartLabels: JSON.stringify(labels),
      userChartData: JSON.stringify(userChartData),
      reservationChartLabels: JSON.stringify(labels),
      reservationChartData: JSON.stringify(reservationChartData)
    };
  },

  addStation: async (stationData) => {
    try {
      const station = {
        name: stationData.name,
        location: stationData.location,
        latitude: stationData.latitude,
        longitude: stationData.longitude,
        coordinates: {
          type: "Point",
          coordinates: [stationData.longitude, stationData.latitude]  // GeoJSON format
        },
        connectors: stationData.connectors,
        slots: stationData.slots,
        rate: stationData.rate,
        outputPower:stationData.outputPower,
        status: stationData.status,
        image: stationData.image
      };

      const result = await db.get().collection(collection.STATION_COLLECTION).insertOne(station);
      console.log('Station inserted:', result.insertedId);

      return result.insertedId;
    } catch (error) {
      console.error('Error adding station:', error);
      throw error;
    }
  },

  getAllStations: async () => {
    try {
      const stations = await db.get().collection(collection.STATION_COLLECTION).find().toArray();
      return stations;
    } catch (err) {
      console.error('Error fetching stations:', err);
      throw err;
    }
  },

  editStation: async (stationId, updatedData) => {
    try {
      const stationObj = {
        name: updatedData.name,
        location: updatedData.location,
        latitude: parseFloat(updatedData.latitude),
        longitude: parseFloat(updatedData.longitude),
        connectors: updatedData.connectors.split(',').map(c => c.trim()),
        slots: parseInt(updatedData.slots),
        rate: parseFloat(updatedData.rate),
        outputPower:parseFloat(updatedData.outputPower),
        status: updatedData.status
      };

      if (updatedData.image) {
        stationObj.image = updatedData.image;
      }

      await db.get().collection(collection.STATION_COLLECTION).updateOne(
        { _id:new ObjectId(stationId) },
        { $set: stationObj }
      );
    } catch (err) {
      console.error('Error editing station:', err);
      throw err;
    }
  },

  toggleStationStatus: async (stationId) => {
    try {
      const station = await db.get().collection(collection.STATION_COLLECTION).findOne({ _id: new ObjectId(stationId) });
      const newStatus = station.status === 'active' ? 'inactive' : 'active';

      await db.get().collection(collection.STATION_COLLECTION).updateOne(
        { _id:new ObjectId(stationId) },
        { $set: { status: newStatus } }
      );

      return newStatus;
    } catch (err) {
      console.error('Error toggling station status:', err);
      throw err;
    }
  },

  getStationById: async (stationId) => {
    try {
      return await db.get().collection(collection.STATION_COLLECTION).findOne({ _id:new ObjectId(stationId) });
    } catch (err) {
      console.error('Error fetching station by ID:', err);
      throw err;
    }
    },
  
    deleteStation: async (stationId) => {
        try {
          await db
            .get()
            .collection(collection.STATION_COLLECTION)
            .deleteOne({ _id: new ObjectId(stationId) });
        } catch (err) {
          throw err;
        }
    },

    getUsers: async (searchQuery) => {
        const query = searchQuery
          ? {
              $or: [
                { name: { $regex: new RegExp(searchQuery, 'i') } },
                { email: { $regex: new RegExp(searchQuery, 'i') } },
              ],
            }
          : {};
    
        return await db
          .get()
          .collection(collection.USER_COLLECTION)
          .find(query)
          .toArray();
      },
    
      toggleUserStatus: async (userId) => {
        const user = await db
          .get()
          .collection(collection.USER_COLLECTION)
          .findOne({ _id: new ObjectId(userId) });
    
        const newStatus = user.status === 'active' ? 'blocked' : 'active';
    
        await db
          .get()
          .collection(collection.USER_COLLECTION)
          .updateOne(
            { _id: new ObjectId(userId) },
            { $set: { status: newStatus } }
          );
      },
    
      deleteUser: async (userId) => {
        await db
          .get()
          .collection(collection.USER_COLLECTION)
          .deleteOne({ _id: new ObjectId(userId) });
      },

      getAllReservations: async (searchText) => {
        const matchStage = searchText
          ? {
              $or: [
                { 'user.name': { $regex: searchText, $options: 'i' } },
                { 'station.name': { $regex: searchText, $options: 'i' } }
              ]
            }
          : {};
    
        const now = new Date();
    
        const reservations = await db.get().collection(collection.RESERVATION_COLLECTION).aggregate([
          {
            $lookup: {
              from: collection.USER_COLLECTION,
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: collection.STATION_COLLECTION,
              localField: 'stationId',
              foreignField: '_id',
              as: 'station'
            }
          },
          { $unwind: '$user' },
          { $unwind: '$station' },
          { $match: matchStage },
          {
            $addFields: {
              datetimeStart: {
                $dateFromString: {
                  dateString: { $concat: ['$date', 'T', '$startTime'] }
                }
              },
              datetimeEnd: {
                $dateFromString: {
                  dateString: { $concat: ['$date', 'T', '$endTime'] }
                }
              }
            }
          },
          {
            $addFields: {
              dynamicStatus: {
                $switch: {
                  branches: [
                    { case: { $lt: [now, '$datetimeStart'] }, then: 'upcoming' },
                    { case: { $and: [{ $gte: [now, '$datetimeStart'] }, { $lte: [now, '$datetimeEnd'] }] }, then: 'ongoing' },
                  ],
                  default: 'complete'
                }
              }
            }
          },
          { $sort: { date: -1, startTime: -1 } }
        ]).toArray();
    
        return reservations;
      },
    
      deleteReservation: async (id) => {
        return await db.get().collection(collection.RESERVATION_COLLECTION).deleteOne({ _id: new ObjectId(id) });
      },

      doLogin: async ({ email, password }) => {
        const admin = await db.get().collection(collection.ADMIN_COLLECTION).findOne({ email });
    
        if (admin && await bcrypt.compare(password, admin.password)) {
          return admin;
        } else {
          return null;
        }
      },


};
