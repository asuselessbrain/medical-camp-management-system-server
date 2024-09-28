const express = require("express");
var cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x6ipdw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client
      .db("medicalCampManagementSystem")
      .collection("users");

    const campCollection = client
      .db("medicalCampManagementSystem")
      .collection("camp");

    // add camp related api

    app.post("/add-camp", async (req, res) => {
      const camp = req.body;

      const result = await campCollection.insertOne(camp);

      res.send(result);
    });

    // get camp related api

    app.get("/my-added-camp/:email", async (req, res) => {
      const email = req.params.email;

      const query = { organizerEmail: email };

      const result = await campCollection
        .find(query)
        .sort({ id: -1 })
        .toArray();

        res.send(result)
    });

    app.put("/user", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const options = { upsert: true };

      const updateDoc = {
        $set: {
          ...user,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // TODO: add jwt verification and admin verification
    // get user from database

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    });

    // TODO: add jwt verification and admin verification
    // update user role

    app.patch("/update-user/:email", async (req, res) => {
      const email = req.params.email;
      const { role } = req.body;

      const query = { email: email };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // delete user from database

    app.delete("/delete-user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await usersCollection.deleteOne(query);

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
