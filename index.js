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
