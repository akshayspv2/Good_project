var express = require('express');
var router = express.Router();
const db = require('../config/connection');
const moment = require('moment');
const adminHelper = require('../helpers/admin_helpers');
const multer = require('multer');
const path = require('path');
const collection = require('../config/collection');

/* GET home page. */
router.get('/',(req,res)=>{
  res.redirect('/admin/admin-login');

});

router.get('/admin-login', (req, res) => {
  res.render('admin/admin-login', { layout: false, error: req.session.adminLoginError });
  req.session.adminLoginError = null; // clear after showing
});

// POST: Admin login form submission
router.post('/login', async (req, res) => {
  try {
    const admin = await adminHelper.doLogin(req.body);
    if (admin) {
      req.session.admin = admin;
      res.redirect('/admin/adminDashboard');
    } else {
      req.session.adminLoginError = 'Invalid email or password';
      res.redirect('/admin/admin-login');
    }
  } catch (err) {
    console.error('Admin login error:', err);
    req.session.adminLoginError = 'Something went wrong';
    res.redirect('/admin/admin-login');
  }
});

// Optional: Logout
router.get('/logout', (req, res) => {
  req.session.admin = null;
  res.redirect('/admin/admin-login');
});



router.get('/adminDashboard', async (req, res) => {
  try {
    const stats = await adminHelper.getDashboardStats();
    res.render('admin/adminDashboard', stats);
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Add Station Form
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/station_images'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  }
});
const upload = multer({ storage });

// GET: Add Station Page
router.get('/add-station', (req, res) => {
  res.render('admin/add-station');
});

// POST: Handle Add Station form
router.post('/add-station', upload.single('image'), async (req, res) => {
  try {
    const latitude = parseFloat(req.body.latitude);
    const longitude = parseFloat(req.body.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).send('Invalid coordinates: latitude and longitude are required and must be valid numbers.');
    }

    const stationData = {
      name: req.body.name,
      location: req.body.location,
      latitude,
      longitude,
      coordinates: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      connectors: req.body.connectors.split(',').map(type => type.trim()),
      slots: parseInt(req.body.slots),
      rate: parseFloat(req.body.rate),
      outputPower :parseFloat(req.body.outputPower),
      status: req.body.status,
      image: req.file ? '/station_images/' + req.file.filename : null
    };

    console.log("Saving station:", stationData);
    await adminHelper.addStation(stationData);
    res.redirect('/admin/add-station');
  } catch (error) {
    console.error('Failed to add station:', error);
    res.status(500).send('Internal Server Error');
  }
});


router.get('/station', async (req, res) => {
  try {
    const stations = await adminHelper.getAllStations(); // get from DB
    res.render('admin/station', { stations });
  } catch (err) {
    console.error('Failed to load station list:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/edit-station/:id', async (req, res) => {
  try {
    const stationId = req.params.id;
    const station = await adminHelper.getStationById(stationId);
    res.render('admin/edit-station', { station });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/station');
  }
});

router.post('/edit-station/:id', upload.single('image'), async (req, res) => {
  try {
    const stationId = req.params.id;
    const updatedData = req.body;

    if (req.file) {
      updatedData.image = '/station_images/' + req.file.filename;
    }

    await adminHelper.editStation(stationId, updatedData);
    res.redirect('/admin/station');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating station');
  }
});

router.post('/toggle-station-status/:id', async (req, res) => {
  try {
    const stationId = req.params.id;
    await adminHelper.toggleStationStatus(stationId);
    res.redirect('/admin/station');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error toggling status');
  }
});

router.post('/delete-station/:id', async (req, res) => {
  try {
    const stationId = req.params.id;
    await adminHelper.deleteStation(stationId);
    res.redirect('/admin/station');
  } catch (err) {
    console.error('Error deleting station:', err);
    res.status(500).send('Error deleting station');
  }
});

router.get('/users', async (req, res) => {
  try {
    const searchQuery = req.query.query || '';
    console.log(searchQuery)
    const users = await adminHelper.getUsers(searchQuery);
    res.render('admin/users', { users });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading users');
  }
});

// Toggle User Status (Block/Unblock)
router.post('/toggle-user-status/:id', async (req, res) => {
  try {
    await adminHelper.toggleUserStatus(req.params.id);
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to update user status');
  }
});

// Delete User
router.post('/delete-user/:id', async (req, res) => {
  try {
    await adminHelper.deleteUser(req.params.id);
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to delete user');
  }
});

// Show all vehicles
router.get('/vehicles', async (req, res) => {
  const vehicles = await db.get().collection(collection.VEHICLE_COLLECTION).find().toArray();
  res.render('admin/vehicles', { vehicles });
});


router.get('/add-vehicle', (req, res) => {
  res.render('admin/add-vehicle');
});

// Handle Vehicle Form Submission
router.post('/add-vehicle', async (req, res) => {
  try {
    const { company, model, capacity } = req.body;

    const vehicleData = {
      company: company.trim(),
      model: model.trim(),
      capacity: parseFloat(capacity),
      createdAt: new Date()
    };

    await db.get().collection(collection.VEHICLE_COLLECTION).insertOne(vehicleData);

    res.redirect('/admin/vehicles'); // You can redirect to a vehicle listing page
  } catch (err) {
    console.error('Error adding vehicle:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/reservations', async (req, res) => {
  try {
    const search = req.query.search || '';
    const reservations = await adminHelper.getAllReservations(search);
    res.render('admin/manage-reservations', { reservations, search });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading reservations');
  }
});

router.post('/reservations/delete/:id', async (req, res) => {
  try {
    await adminHelper.deleteReservation(req.params.id);
    res.redirect('/admin/reservations');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to delete reservation');
  }
});


module.exports = router;
