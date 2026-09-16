# ChargeNow ⚡

ChargeNow is a full-stack web application for finding, reserving, and managing EV (electric vehicle) charging station slots. It provides a user-facing portal for locating nearby charging stations and booking time slots, plus an admin dashboard for managing stations, vehicles, users, and reservations.

## Features

### User side
- User signup / login with session-based authentication
- Password reset via email (Nodemailer)
- Find nearby charging stations using geolocation (powered by [OpenChargeMap API](https://openchargemap.org/) + `geolib` for distance calculations)
- Search stations and view station details (ratings/reviews included)
- Reserve a charging slot, with slot-availability checks
- Mock payment flow to confirm a reservation
- Reservation history and cancellation
- Favorite stations
- User profile management

### Admin side
- Admin login and dashboard
- Add / edit / delete charging stations (with image upload via `multer`)
- Enable / disable station status
- Manage registered vehicles
- Manage users (enable/disable, delete)
- View and manage all reservations

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Templating:** Handlebars (`express-handlebars` / `hbs`)
- **Database:** MongoDB (via the native `mongodb` driver)
- **Auth & Sessions:** `express-session`, `bcrypt`, `cookie-parser`
- **File Uploads:** `multer`
- **Email:** `nodemailer`
- **Geolocation:** `geolib`, OpenChargeMap API
- **Other:** `dotenv`, `morgan`, `moment`

## Project Structure

```
.
├── app.js                  # Express app setup and middleware
├── bin/www                 # Server entry point
├── config/
│   ├── connection.js       # MongoDB connection handling
│   ├── collection.js       # Collection name constants
│   ├── mailer.js           # Nodemailer configuration
│   └── middle.js           # Custom middleware (auth checks, etc.)
├── helpers/
│   ├── user_helpers.js     # User-side business logic
│   └── admin_helpers.js    # Admin-side business logic
├── routes/
│   ├── users.js            # User-facing routes
│   └── admin.js            # Admin-facing routes
├── views/
│   ├── user/                # User-facing Handlebars templates
│   ├── admin/                # Admin Handlebars templates
│   ├── layout/                # Shared layout
│   └── error.hbs
└── public/
    └── station_images/     # Uploaded station images
```

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MongoDB](https://www.mongodb.com/) running locally (default: `mongodb://127.0.0.1:27017`)
- An [OpenChargeMap API key](https://openchargemap.org/site/develop/api) (for nearby-station lookups)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/akshayspv2/Good_project.git
   cd Good_project
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with the following variables:
   ```env
   OCM_API_KEY=your_openchargemap_api_key
   PORT=4000
   ```

4. Make sure MongoDB is running locally, then start the server:
   ```bash
   npm start
   ```

5. Visit the app:
   - User portal: `http://localhost:4000/`
   - Admin portal: `http://localhost:4000/admin`

## Environment Variables

| Variable      | Description                                  |
|---------------|-----------------------------------------------|
| `OCM_API_KEY` | API key for the OpenChargeMap service          |
| `PORT`        | Port the server listens on (defaults to 4000)  |

## Notes

- The MongoDB database name is set to `miniproject` by default (see `config/connection.js`); update this as needed for your environment.
- Session secret and other sensitive configuration should be moved out of source code and into environment variables before deploying to production.

## License

ISC
