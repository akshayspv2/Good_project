const axios = require("axios");
const express = require('express');
const router = express.Router();
const userHelpers = require('../helpers/user_helpers');
const db = require('../config/connection');
const collection = require('../config/collection');
const { ObjectId } = require('mongodb');
const moment = require('moment'); 
const mailer = require('../config/mailer');
const crypto = require('crypto');

// Middleware to check if user is logged in
function verifyUserSession(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// GET root → redirect based on session
router.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.render('user/getstarted', { year: new Date().getFullYear() });
  }
});


// GET login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.render('user/login', { error: req.session.loginError });
    req.session.loginError = null;
  }
});

// POST login form
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await userHelpers.verifyLogin(email, password);
    if (user) {
      req.session.user = user;
      req.session.loggedIn = true;
      res.redirect('/dashboard');
    } else {
      req.session.loginError = 'Invalid email or password.';
      res.redirect('/login');
    }
  } catch (err) {
    console.error('Login error:', err);
    req.session.loginError = 'Something went wrong. Please try again.';
    res.redirect('/login');
  }
});

function verifyLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}



// Dashboard Route
router.get('/dashboard', verifyLogin, async (req, res) => {
  if(req.session.user){
  try {
    
    const userId = req.session.user._id;
    const dashboardData = await userHelpers.getUserDashboardData(userId);

    res.render('user/dashboard', {
      user: req.session.user,
      reservations: dashboardData.reservations,
      favorites: dashboardData.favorites,
      usage: dashboardData.usage,
      tips: dashboardData.tips,
      usage: {
        kwh: 140,
        sessions: 12,
        amount: 1700,
        monthlyKwh: [20, 35, 40, 45],
        monthlySpending: [400, 600, 500, 700]
      },
      months: ['Jan', 'Feb', 'Mar', 'Apr']
    });
  

  } catch (err) {
    console.error("Error loading user dashboard:", err);
    res.status(500).send("Something went wrong.");
  }
}
else{
  res.redirect('/login')
}
});

// API: Get Nearby Stations (POST from JS)
/*router.post('/nearby-stations', async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;

    const stations = await db.get().collection(collection.STATION_COLLECTION).aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [longitude, latitude] },
          distanceField: "distance",
          maxDistance: radius * 1000, // convert km to meters
          spherical: true
        }
      },
      {
        $match: { status: "active" }
      }
    ]).toArray();

    // ✅ Flatten coordinates and convert distance to km
    const formattedStations = stations.map(station => ({
      ...station,
      coordinates: station.coordinates?.coordinates || [],
      distance: +(station.distance / 1000).toFixed(2) // convert to km and round
    }));

    res.json(formattedStations);
  } catch (err) {
    console.error("Nearby stations fetch failed:", err);
    res.status(500).send("Failed to fetch nearby stations");
  }
}); 
router.post("/nearby-stations", async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;

    const response = await axios.get(
      "https://api.openchargemap.io/v3/poi/",
      {
        headers: {
          "X-API-Key": process.env.OCM_API_KEY
        },
        params: {
          latitude,
          longitude,
          distance: radius || 10,
          maxresults: 10,
          countrycode: "IN"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("OpenChargeMap error:", error.message);
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});*/ 
 // make sure this is at top of file

router.get("/api/stations/nearby", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    console.log("Fetching stations for:", lat, lng);

    const response = await axios.get(
      "https://api.openchargemap.io/v3/poi/",
      {
        headers: {
          "X-API-Key": process.env.OCM_API_KEY
        },
        params: {
          latitude: lat,
          longitude: lng,
          distance: 10,
          maxresults: 20,
          countrycode: "IN"
        }
      }
    );

    console.log("Stations found:", response.data.length);

    res.json(response.data);
  } catch (error) {
    console.error("OpenChargeMap error:", error.message);
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});



// GET logout route
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

router.get('/stations',verifyUserSession, async (req, res) => {
  if(req.session.user){
  res.render('user/find-stations'); // find-stations.hbs
  }
  else{
    res.redirect('/login');
  }
});


// Show find stations page
router.get('/stations/nearby', async (req, res) => {
  const { lat, lng } = req.query;
  try {
    const stations = await userHelpers.getNearbyStations(parseFloat(lat), parseFloat(lng));
    res.json(stations);
  } catch (err) {
    console.error('Error fetching nearby stations:', err);
    res.status(500).json({ error: 'Failed to fetch nearby stations' });
  }
});

// Search stations by name or location
router.get('/stations/search', async (req, res) => {
  const query = req.query.query;
  try {
    const stations = await userHelpers.searchStations(query);
    res.json(stations);
  } catch (err) {
    console.error('Error searching stations:', err);
    res.status(500).json({ error: 'Failed to search stations' });
  }
});

router.get('/stationss/:id', async (req, res) => {
  const stationId = req.params.id;
  const station = await db.get().collection(collection.STATION_COLLECTION).findOne({ _id: new ObjectId(stationId) });

  if (!station) {
    return res.status(404).send("Station not found");
  }

  res.render('user/station-details', { station });
});

/*router.get('/stations/:id',verifyUserSession, async (req, res) => {
  if(req.session.user){
  try {
    const stationId = req.params.id;
    console.log(stationId)
   
    console.log('station id routere git')
    if (!ObjectId.isValid(stationId)) {
      return res.status(400).send("Invalid station ID");
    }

    const station = await db
      .get()
      .collection(collection.STATION_COLLECTION)
      .findOne({ _id: new ObjectId(stationId) });


    console.log(station)

    if (!station) {
      return res.status(404).send("Station not found");
    }

    res.render('user/station-details', { station });
  } catch (error) {
    console.error("Error fetching station details:", error);
    res.status(500).send("Internal Server Error");
  }
}
else{
  res.redirect('/login');
}
});*/

/*router.get('/stations/:id', verifyUserSession, async (req, res) => {
  if (req.session.user) {
    const userId = req.session.user._id;
    try {
      const stationId = req.params.id;
      if (!ObjectId.isValid(stationId)) {
        return res.status(400).send("Invalid station ID");
      }

      // Fetch station
      const station = await db
        .get()
        .collection(collection.STATION_COLLECTION)
        .findOne({ _id: new ObjectId(stationId) });

      if (!station) {
        return res.status(404).send("Station not found");
      }

      // Get today's date in YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];

      // Fetch active reservations for today
      const reservations = await db
        .get()
        .collection(collection.RESERVATION_COLLECTION)
        .find({
          stationId: new ObjectId(stationId),
          date: today
          //status: 'active' // you can adjust this depending on your schema
        })
        .toArray();

      // Calculate available slots
      const availableSlots = station.slots - reservations.length;

      const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) });
      // Pass station details along with available/total slots
      res.render('user/station-details', {user,
        station: {
          ...station,
          availableSlots: Math.max(availableSlots, 0), // ensure non-negative
          totalSlots: station.slots
        }
      });
    } catch (error) {
      console.error("Error fetching station details:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect('/login');
  }
});*/

/*router.get('/stations/:id', verifyUserSession, async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const userId = req.session.user._id;

  try {
    const stationId = req.params.id;
    if (!ObjectId.isValid(stationId)) {
      return res.status(400).send("Invalid station ID");
    }

    // Fetch station
    const station = await db
      .get()
      .collection(collection.STATION_COLLECTION)
      .findOne({ _id: new ObjectId(stationId) });

    if (!station) {
      return res.status(404).send("Station not found");
    }

    // Get today's date and current time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0]; // 'HH:MM:SS'

    // Fetch active reservations for today where endTime > current time
    const reservations = await db
      .get()
      .collection(collection.RESERVATION_COLLECTION)
      .find({
        stationId: new ObjectId(stationId),
        date: today,
        endTime: { $gt: currentTime.substring(0, 5) } // match format 'HH:MM'
      })
      .toArray();

    // Calculate available slots
    const availableSlots = station.slots - reservations.length;

    // Fetch user details
    const user = await db
      .get()
      .collection(collection.USER_COLLECTION)
      .findOne({ _id: new ObjectId(userId) });

    // Render page with station and slot details
    res.render('user/station-details', {
      user,
      station: {
        ...station,
        availableSlots: Math.max(availableSlots, 0), // Prevent negative values
        totalSlots: station.slots
      }
    });

  } catch (error) {
    console.error("Error fetching station details:", error);
    res.status(500).send("Internal Server Error");
  }
});*/

router.post('/stations/:stationId/reviews',verifyUserSession, async (req, res) => {
  const stationId = req.params.stationId;
  const userId = req.session.user._id;
  const { rating, comment } = req.body;

  try {
    const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) });
    const review = {
      user: user.name,
      rating: parseInt(rating),
      comment,
      date: new Date()
    };

    await db.get().collection(collection.STATION_COLLECTION).updateOne(
      { _id: new ObjectId(stationId) },
      { $push: { reviews: review } }
    );

    res.redirect(`/stations/${stationId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error submitting review');
  }
});
/*router.get('/stations/:id', verifyUserSession, async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const userId = req.session.user._id;

  try {
    const stationId = req.params.id;
    if (!ObjectId.isValid(stationId)) {
      return res.status(400).send("Invalid station ID");
    }

    const station = await db
      .get()
      .collection(collection.STATION_COLLECTION)
      .findOne({ _id: new ObjectId(stationId) });

    if (!station) {
      return res.status(404).send("Station not found");
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // 'HH:MM'

    // Fetch reservations only for today, and still active
    const activeReservations = await db
      .get()
      .collection(collection.RESERVATION_COLLECTION)
      .find({
        stationId: new ObjectId(stationId),
        date: today,
        endTime: { $gt: currentTime } // only future reservations
      })
      .toArray();

    const availableSlots = Math.max(station.slots - activeReservations.length, 0);

    const user = await db
      .get()
      .collection(collection.USER_COLLECTION)
      .findOne({ _id: new ObjectId(userId) });

    res.render('user/station-details', {
      user,
      station: {
        ...station,
        availableSlots,
        totalSlots: station.slots
      }
    });

  } catch (error) {
    console.error("Error fetching station details:", error);
    res.status(500).send("Internal Server Error");
  }
});*/

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":").map(Number);
  return parts[0] * 60 + (parts[1] || 0); // safe for HH:MM or HH:MM:SS
}

router.get('/stations/:id', verifyUserSession, async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const userId = req.session.user._id;

  try {
    const stationId = req.params.id;
    if (!ObjectId.isValid(stationId)) {
      return res.status(400).send("Invalid station ID");
    }

    const station = await db
      .get()
      .collection(collection.STATION_COLLECTION)
      .findOne({ _id: new ObjectId(stationId) });

    if (!station) {
      return res.status(404).send("Station not found");
    }

    const now = moment(); // current date and time
    const todayStr = now.format('YYYY-MM-DD');

    const reservations = await db
      .get()
      .collection(collection.RESERVATION_COLLECTION)
      .find({ stationId: new ObjectId(stationId), date: todayStr })
      .toArray();

    // Filter active reservations: endTime > current time
    const activeReservations = reservations.filter(res => {
      const endTime = moment(res.endTime, 'HH:mm');
      return endTime.isAfter(now);
    });

    const availableSlots = Math.max(station.slots - activeReservations.length, 0);

    const user = await db
      .get()
      .collection(collection.USER_COLLECTION)
      .findOne({ _id: new ObjectId(userId) });

    res.set('Cache-Control', 'no-store'); // disable browser cache
    res.render('user/station-details', {
      user,
      station: {
        ...station,
        availableSlots,
        totalSlots: station.slots
      }
    });

  } catch (error) {
    console.error("Error fetching station details:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post('/favorite/:stationId', async (req, res) => {
  const userId = req.session.user._id;
  const stationId = req.params.stationId;
  console.log('favourite hit')
  try {
    const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) });

    const alreadyFavorited = user.favorites?.includes(stationId);

    if (alreadyFavorited) {
      await db.get().collection(collection.USER_COLLECTION).updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { favorites: stationId } }
      );
    } else {
      await db.get().collection(collection.USER_COLLECTION).updateOne(
        { _id: new ObjectId(userId) },
        { $addToSet: { favorites: stationId } }
      );
    }
  
    res.status(200).send();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating favorites');
  }
});

router.post('/stations/:id/check-slot', verifyUserSession, async (req, res) => {
  const { date, startTime, endTime } = req.body;
  const stationId = req.params.id;

  try {
    const overlapReservation = await db.get().collection(collection.RESERVATION_COLLECTION).findOne({
      stationId: new ObjectId(stationId),
      date,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    });

    if (overlapReservation) {
      return res.json({ available: false });
    } else {
      return res.json({ available: true });
    }
  } catch (err) {
    console.error('Slot check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /stations/:id/reserve-slot
router.post('/stations/:id/reserve-slot', async (req, res) => {
  const { date, startTime, endTime } = req.body;
  const stationId = req.params.id;
  const userId = req.session.user._id; // assuming session stores user

  await db.get().collection(collection.RESERVATION_COLLECTION).insertOne({
    stationId,
    userId,
    date,
    startTime,
    endTime,
    status: 'Reserved'
  });

  res.sendStatus(200);
});

router.get('/stations/:id/reservations', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  const reservations = await userHelpers.getReservationsByStation(id, date);
  res.json(reservations);
});

router.get('/reserve/:stationId', async (req, res) => {
  console.log('reserve form hit')
  const stationId = req.params.stationId;
  const { error, previousInput } = req.query;
  try {
    console.log('working i think')
    const station = await userHelpers.getStationByIdWithUpdatedSlots(stationId);
    res.render('user/reserve-form', { station, error, previousInput: JSON.parse(previousInput || '{}') });
  } catch (err) {
    res.redirect('/error');
  }
});

// Handle reservation
router.post('/reserve/:stationId', async (req, res) => {
  const { stationId } = req.params;
  const { date, startTime, endTime } = req.body;
  const userId = req.session.user._id;

  const station = await userHelpers.getStationByIdWithUpdatedSlots(stationId);

  const now = new Date();
  const reservationStart = new Date(`${date}T${startTime}`);
  const reservationEnd = new Date(`${date}T${endTime}`);

  // Check for past or invalid times
  if (reservationStart < now || reservationEnd <= reservationStart) {
    return res.render('user/reserve-form', {
      station,
      error: 'Invalid or past time selected.',
      previousInput: { date, startTime, endTime }
    });
  }

  // Check for overlapping reservation
  const existingReservations = await db.get().collection(collection.RESERVATION_COLLECTION).find({
    stationId: new ObjectId(stationId),
    date,
    status: { $ne: 'cancelled' }, // Skip cancelled ones
    $or: [
      {
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }
    ]
  }).toArray();

  if (existingReservations.length > 0) {
    return res.render('user/reserve-form', {
      station,
      error: 'Selected slot overlaps with an existing reservation. Please choose another time.',
      previousInput: { date, startTime, endTime }
    });
  }

  const duration = (reservationEnd - reservationStart) / (1000 * 60 * 60); // in hours
  const totalPrice = duration * station.rate;

  const reservation = {
    userId,
    stationId,
    date,
    startTime,
    endTime,
    status: 'pending'
  };

  // Render confirmation page before saving
  res.render('user/confirm-reservation', {
    station,
    reservation,
    duration: duration.toFixed(2),
    totalPrice: totalPrice.toFixed(2)
  });
});

router.post('/payment', async (req, res) => {
  const { stationId, date, startTime, endTime } = req.body;
  const userId = req.session.user._id;

  const reservationStart = new Date(`${date}T${startTime}`);
  const reservationEnd = new Date(`${date}T${endTime}`);
  const duration = (reservationEnd - reservationStart) / (1000 * 60 * 60);

  const station = await userHelpers.getStationByIdWithUpdatedSlots(stationId);
  const totalPrice = duration * station.rate;

  res.render('user/payment_gateway', {
    userId,
    stationId,
    date,
    startTime,
    endTime,
    duration: duration.toFixed(2),
    totalPrice: totalPrice.toFixed(2),
    station
  });
});



// POST route for payment confirmation
router.post('/payment/confirm', async (req, res) => {
  try {
    const {
      userId,
      stationId,
      date,
      startTime,
      endTime,
      duration,
      totalPrice
    } = req.body;

    // Detect payment method
    let paymentMethod = '';
    if (req.body.cardName) paymentMethod = 'Card';
    else if (req.body.bank) paymentMethod = 'Net Banking';
    else if (req.body.upiId) paymentMethod = 'UPI';
    else paymentMethod = 'Unknown';

    // Generate reservation code
    const reservationCode = Math.floor(100000 + Math.random() * 900000);

    // Fetch user details (email and name) from session or DB
    let user;
    if (req.session.user) {
      user = req.session.user;
    } else {
      user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) });
    }
    const station = await db.get().collection(collection.STATION_COLLECTION).findOne({ _id: new ObjectId(stationId) });

    // Insert reservation into DB
    await db.get().collection(collection.RESERVATION_COLLECTION).insertOne({
      userId: new ObjectId(userId),
      userName: user.name,
      userEmail: user.email,
      stationName:station.name,
      ouputPower:station.ouputPower,
      stationId: new ObjectId(stationId),
      date,
      startTime,
      endTime,
      duration: parseFloat(duration),
      totalPrice: parseFloat(totalPrice),
      paymentMethod,
      reservationCode,
      status: 'confirmed',
      createdAt: new Date()
    });

    // Render confirmation page
    res.render('user/payment-success', {
      code: reservationCode,
      date,
      startTime,
      endTime
    });

  } catch (err) {
    console.error('Payment confirmation failed:', err);
    res.status(500).send('Something went wrong. Please try again.');
  }
});

router.get('/reservation-history', verifyUserSession, async (req, res) => {
  const userId = req.session.user._id;
  const filterDate = req.query.date;

  let match = { userId: new ObjectId(userId) };
  if (filterDate) match.date = filterDate;

  const reservations = await db.get().collection(collection.RESERVATION_COLLECTION).aggregate([
    { $match: match },
    {
      $lookup: {
        from: collection.STATION_COLLECTION,
        localField: 'stationId',
        foreignField: '_id',
        as: 'station'
      }
    },
    { $unwind: "$station" }
  ]).toArray();

  const now = new Date();

  // Add dynamic status
  const enrichedReservations = reservations.map(r => {
    const start = new Date(`${r.date}T${r.startTime}`);
    const end = new Date(`${r.date}T${r.endTime}`);

    let dynamicStatus = 'upcoming';
    if (now >= end) dynamicStatus = 'complete';
    else if (now >= start && now < end) dynamicStatus = 'ongoing';

    return { ...r, dynamicStatus };
  });

  res.render('user/reservation-history', {
    reservations: enrichedReservations,
    selectedDate: filterDate || ''
  });
});


function isUserLoggedIn(req, res, next) {
  if (req.session.user) next();
  else res.redirect('/login');
}

// GET profile
router.get('/profile', isUserLoggedIn, async (req, res) => {
  try {
    const user = await userHelpers.getUserById(req.session.user._id);
    res.render('user/profile', { user });
  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).send('Internal Server Error');
  }
});

// POST profile edit
router.post('/profile/edit', isUserLoggedIn, async (req, res) => {
  try {
    const updatedData = {
      name: req.body.name?.trim(),
      phone: req.body.phone?.trim(),
    };

    await userHelpers.updateUserProfile(req.session.user._id, updatedData);

    // Also update session data if name changed
    req.session.user.name = updatedData.name;

    res.redirect('/profile');
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).send('Failed to update profile');
  }
});

router.get('/signup', (req, res) => {
  res.render('user/signup', { errorMessage: null });
});

// Handle signup POST
router.post('/signup', async (req, res) => {
  try {
    const result = await userHelpers.registerUser(req.body);

    if (result.success) {
      // You can redirect to login or dashboard after signup
      res.redirect('/login');
    } else {
      res.render('user/signup', { errorMessage: result.message });
    }
  } catch (err) {
    console.error(err);
    res.render('user/signup', { errorMessage: 'Something went wrong. Please try again.' });
  }
});

router.get('/forgot-password', (req, res) => {
  res.render('user/forgot-password');
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await db.get().collection(collection.USER_COLLECTION).findOne({ email });
    if (!user) {
      return res.render('user/forgot-password', { error: 'Email not found.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await db.get().collection(collection.USER_COLLECTION).updateOne(
      { _id: user._id },
      { $set: { resetToken: token, resetTokenExpire: tokenExpire } }
    );

    const resetLink = `http://localhost:3000/reset-password/${token}`;
    await mailer.sendResetEmail(email, resetLink);

    res.render('user/forgot-password', { success: 'Reset link sent! Check your email.' });
  } catch (err) {
    console.error(err);
    res.render('user/forgot-password', { error: 'Something went wrong.' });
  }
});

router.get('/reset-password/:token', async (req, res) => {
  const token = req.params.token;
  const user = await db.get().collection(collection.USER_COLLECTION).findOne({
    resetToken: token,
    resetTokenExpire: { $gt: new Date() }
  });

  if (!user) return res.send('Token expired or invalid.');

  res.render('user/reset-password', { token });
});

router.post('/reset-password/:token', async (req, res) => {
  const token = req.params.token;
  const { password } = req.body;

  const user = await db.get().collection(collection.USER_COLLECTION).findOne({
    resetToken: token,
    resetTokenExpire: { $gt: new Date() }
  });

  if (!user) return res.send('Invalid or expired token.');

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.get().collection(collection.USER_COLLECTION).updateOne(
    { _id: user._id },
    {
      $set: { password: hashedPassword },
      $unset: { resetToken: "", resetTokenExpire: "" }
    }
  );

  res.redirect('/login');
});

router.post('/cancel-reservation', async (req, res) => {
  const { reservationId } = req.body;
  try {
    await db.get().collection(collection.RESERVATION_COLLECTION).deleteOne({ _id: new ObjectId(reservationId) });
    res.redirect('/reservation-history');
  } catch (err) {
    console.error('Error deleting reservation:', err);
    res.status(500).send('Something went wrong.');
  }
});


module.exports = router;

