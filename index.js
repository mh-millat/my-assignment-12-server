const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173'], // তোমার ফ্রন্টএন্ড URL
    credentials: true
}));
app.use(express.json());

// MongoDB URI setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v23il5n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



// Collections
let bookingsCollection;
let usersCollection;
let couponsCollection;
let announcementsCollection;
let courtsCollection;

// JWT Middleware
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send({ error: 'Unauthorized access' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).send({ error: 'Forbidden access' });
        req.user = decoded;
        next();
    });
}

// Main App Logic
async function run() {
    try {
        await client.connect();
        const db = client.db("sportsDB");

        bookingsCollection = db.collection("bookings");
        usersCollection = db.collection("users");
        couponsCollection = db.collection("coupons");
        announcementsCollection = db.collection("announcements");
        courtsCollection = db.collection("courts");
        const membersCollection = client.db('sportsClubDB').collection('members');

// GET all members
app.get('/members', async (req, res) => {
  try {
    const members = await membersCollection.find().toArray();
    res.send(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).send({ error: 'Failed to load members' });
  }
});



        app.post('/jwt', (req, res) => {
            const user = req.body; // e.g. { email: 'abc@example.com' }
            if (!process.env.JWT_SECRET) {
                return res.status(500).send({ error: "JWT_SECRET not configured" });
            }
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '2h' });
            res.send({ token });
        });

       

        // Get user role by email (Protected route)
        app.get('/users/role/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            try {
                const user = await usersCollection.findOne({ email });
                res.send({ role: user?.role || 'user' });
            } catch {
                res.status(500).send({ error: "Error fetching role" });
            }
        });

        // controllers/userController.js




// PATCH: Update user role by ID
app.patch('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Optional: Validate role
        const validRoles = ['admin', 'member', 'user'];
        if (!validRoles.includes(role)) {
            return res.status(400).send({ error: 'Invalid role value' });
        }

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { role } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).send({ error: 'User not found or role not changed' });
        }

        res.send({ message: `Role updated to ${role}` });
    } catch (error) {
        console.error('Failed to update user role:', error);
        res.status(500).send({ error: 'Failed to update user role' });
    }
});


// GET: Get all users
app.get('/users', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.send(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).send({ error: 'Failed to fetch users' });
  }
});


















       

        const updateUserRole = async (req, res) => {
            const { id } = req.params;
            const { role } = req.body;

            // Optional: Validate role
            const validRoles = ['admin', 'member', 'user'];
            if (!validRoles.includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }

            try {
                const updatedUser = await User.findByIdAndUpdate(
                    id,
                    { role },
                    { new: true }
                );

                if (!updatedUser) {
                    return res.status(404).json({ message: 'User not found' });
                }

                res.json({ message: `Role updated to ${role}`, user: updatedUser });
            } catch (error) {
                res.status(500).json({ message: 'Server error', error });
            }
        };


        
        module.exports = {
            updateUserRole,
        };










        // ======= BOOKINGS ROUTES =======

        // app.get('/bookings', async (req, res) => {
        //     try {
        //         const bookings = await bookingsCollection.find().toArray();
        //         res.send(bookings);
        //     } catch (error) {
        //         res.status(500).send({ error: 'Failed to fetch bookings' });
        //     }
        // });

        app.get('/bookings', async (req, res) => {
            try {
                const { status } = req.query;
                let query = {};
                if (status) query.status = status;

                const bookings = await bookingsCollection.find(query).toArray();
                res.send(bookings);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch bookings' });
            }
        });


        // app.get('/bookings/confirmed', async (req, res) => {
        //     try {
        //         const page = parseInt(req.query.page) || 1;
        //         const limit = parseInt(req.query.limit) || 10;
        //         const skip = (page - 1) * limit;

        //         const query = { status: 'confirmed' };
        //         const total = await bookingsCollection.countDocuments(query);
        //         const bookings = await bookingsCollection.find(query).skip(skip).limit(limit).toArray();
        //         const totalPages = Math.ceil(total / limit);

        //         res.send({ bookings, totalPages });
        //     } catch (error) {
        //         res.status(500).send({ error: 'Failed to fetch confirmed bookings' });
        //     }
        // });

        app.get('/bookings/confirmed', async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const skip = (page - 1) * limit;

                // ✅ এখানে পরিবর্তনটা হল
                const query = { status: { $in: ['confirmed', 'approved'] } };

                const total = await bookingsCollection.countDocuments(query);
                const bookings = await bookingsCollection
                    .find(query)
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                const totalPages = Math.ceil(total / limit);

                res.send({ bookings, totalPages });
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch confirmed bookings' });
            }
        });

        // app.get('/bookings', async (req, res) => {
        //     try {
        //         const { status } = req.query;

        //         let query = {};
        //         if (status) {
        //             query.status = status;
        //         }

        //         const bookings = await bookingsCollection.find(query).toArray();
        //         res.send(bookings);
        //     } catch (error) {
        //         res.status(500).send({ error: 'Failed to fetch bookings' });
        //     }
        // });


        app.post('/bookings', async (req, res) => {
            try {
                const booking = req.body;
                booking.status = 'pending';
                const result = await bookingsCollection.insertOne(booking);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to add booking' });
            }
        });

