const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());


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
            const user = req.body;
            if (!process.env.JWT_SECRET) {
                return res.status(500).send({ error: "JWT_SECRET not configured" });
            }
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '2h' });
            res.send({ token });
        });

        app.get('/users/role/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            try {
                const user = await usersCollection.findOne({ email });
                res.send({ role: user?.role || 'user' });
            } catch {
                res.status(500).send({ error: "Error fetching role" });
            }
        });

        app.patch('/users/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { role } = req.body;


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

        app.get('/bookings/confirmed', async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const skip = (page - 1) * limit;

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

        app.patch('/bookings/:id/status', async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;
                if (!['pending', 'confirmed', 'rejected', 'approved'].includes(status)) {
                    return res.status(400).send({ error: 'Invalid status value' });
                }
                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to update status' });
            }
        });

        app.delete('/bookings/:id', async (req, res) => {
            try {
                const result = await bookingsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to delete booking' });
            }
        });


        app.patch('/bookings/approve/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'approved' } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to approve booking' });
            }
        });


        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const existingUser = await usersCollection.findOne({ email: user.email });
                if (existingUser) return res.status(400).send({ message: 'User already exists' });

                user.role = user.role || 'user';
                const result = await usersCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to add user' });
            }
        });

        app.get('/users', async (req, res) => {
            try {
                const users = await usersCollection.find().toArray();
                res.send(users);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch users' });
            }
        });



        app.get('/members', async (req, res) => {
            try {
                const members = await usersCollection.find().toArray();
                res.send(members);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch members' });
            }
        });


        app.get('/courts', async (req, res) => {
            try {
                const courts = await courtsCollection.find().toArray();
                res.send(courts);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch courts' });
            }
        });

        app.post('/courts', async (req, res) => {
            try {
                const court = req.body;
                if (!court.name || !court.type || court.price == null) {
                    return res.status(400).send({ error: 'Missing required fields' });
                }
                const result = await courtsCollection.insertOne(court);
                res.send({ insertedId: result.insertedId });
            } catch (error) {
                res.status(500).send({ error: 'Failed to add court' });
            }
        });

        app.patch('/courts/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (!ObjectId.isValid(id)) return res.status(400).send({ error: 'Invalid ID' });

                const result = await courtsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: req.body }
                );
                if (result.matchedCount === 0) return res.status(404).send({ error: 'Court not found' });

                res.send({ modifiedCount: result.modifiedCount });
            } catch (error) {
                res.status(500).send({ error: 'Failed to update court' });
            }
        });

        app.delete('/courts/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (!ObjectId.isValid(id)) return res.status(400).send({ error: 'Invalid ID' });

                const result = await courtsCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 0) return res.status(404).send({ error: 'Court not found' });

                res.send({ deletedCount: result.deletedCount });
            } catch (error) {
                res.status(500).send({ error: 'Failed to delete court' });
            }
        });

        app.get('/coupons', async (req, res) => {
            try {
                const coupons = await couponsCollection.find().toArray();
                res.send(coupons);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch coupons' });
            }
        });

        app.post('/coupons', async (req, res) => {
            try {
                const result = await couponsCollection.insertOne(req.body);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to add coupon' });
            }
        });

        app.patch('/coupons/:id', async (req, res) => {
            try {
                const result = await couponsCollection.updateOne(
                    { _id: new ObjectId(req.params.id) },
                    { $set: req.body }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to update coupon' });
            }
        });

        app.delete('/coupons/:id', async (req, res) => {
            try {
                const result = await couponsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to delete coupon' });
            }
        });

        app.get('/announcements', async (req, res) => {
            try {
                const announcements = await announcementsCollection.find().toArray();
                res.send(announcements);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch announcements' });
            }
        });

        app.post('/announcements', async (req, res) => {
            try {
                const result = await announcementsCollection.insertOne(req.body);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to add announcement' });
            }
        });

        app.patch('/announcements/:id', async (req, res) => {
            try {
                const result = await announcementsCollection.updateOne(
                    { _id: new ObjectId(req.params.id) },
                    { $set: req.body }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to update announcement' });
            }
        });

        app.delete('/announcements/:id', async (req, res) => {
            try {
                const result = await announcementsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to delete announcement' });
            }
        });

        console.log(" MongoDB Connected & All Routes Ready!");

    } catch (error) {
        console.error(" Server error:", error);
    }
}
run();

app.get('/', (req, res) => {
    res.send(' Sports Booking Server is Running');
});

app.listen(port, () => {
    console.log(` Server running at http://localhost:${port}`);
});
