const express = require("express");
var cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRITE_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = 3000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://medicare-by-arfan.netlify.app"],
  })
);
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

    const participantDetailsCollection = client
      .db("medicalCampManagementSystem")
      .collection("participantDetails");

    //get popular camp related api
    app.get("/popular-camp", async (req, res) => {
      const result = await campCollection
        .find()
        .sort({ participantCount: -1 })
        .limit(8)
        .toArray();
      res.send(result);
    });

    // get all camp related api
    app.get("/all-camp", async (req, res) => {
      const query = req.query;
      const currentPage = parseInt(query.currentPage);
      const numberOfCampPerPage = parseInt(query.numberOfCampPerPage);
      const sortData = query.sortData;
      const currentData = new Date();

      let sortOption = {};

      if (sortData === "ascending") {
        sortOption.campFee = 1;
      } else if (sortData === "descending") {
        sortOption.campFee = -1;
      } else if (sortData === "sortByParticipant") {
        sortOption.participantCount = -1;
      } else {
        sortOption = { _id: -1 };
      }

      let filter = {};
      if (query.search) {
        filter.campName = { $regex: query.search, $options: "i" };
      }
      if (query.searchLocation) {
        filter.campLocation = { $regex: query.searchLocation, $options: "i" };
      }

      filter.campTime = { $gte: currentData.toISOString() };

      const result = await campCollection
        .find(filter)
        .sort(sortOption)
        .skip(currentPage * numberOfCampPerPage)
        .limit(numberOfCampPerPage)
        .toArray();
      res.send(result);
    });

    // get total camp number related api

    app.get("/get-total-camp-number", async (req, res) => {
      const query = req.query;
      const currentDate = new Date();

      let filter = {};
      if (query.search) {
        filter.campName = { $regex: query.search, $options: "i" };
      }

      if (query.searchLocation) {
        filter.campLocation = { $regex: query.searchLocation, $options: "i" };
      }

      filter.campTime = { $gte: currentDate.toISOString() };
      const totalCamp = await campCollection.countDocuments(filter);
      res.send({ totalCamp });
    });

    // get previous camp related api
    app.get("/previous-camp", async (req, res) => {
      const currentDate = new Date();

      let filter = {};

      filter.campTime = { $lt: currentDate.toISOString() };
      const result = await campCollection
        .find(filter)
        .sort({ participantCount: -1 })
        .limit(8)
        .toArray();
      res.send(result);
    });

    // get camp details related api

    app.get("/view-camp-details/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await campCollection.findOne(query);
      res.send(result);
    });

    // post join camp related api

    app.post("/join-camp", async (req, res) => {
      const participantDetails = req.body;
      const campId = participantDetails.campId;

      const result = await participantDetailsCollection.insertOne(
        participantDetails
      );

      const query = { _id: new ObjectId(campId) };

      const updatedResult = await campCollection.updateOne(query, {
        $inc: { participantCount: 1 },
      });

      res.send({ result, updatedResult });
    });

    // add camp related api

    app.post("/add-camp", async (req, res) => {
      const camp = req.body;

      const result = await campCollection.insertOne(camp);

      res.send(result);
    });

    // get my added camp related api

    app.get("/my-added-camp/:email", async (req, res) => {
      const email = req.params.email;

      const query = { organizerEmail: email };

      const result = await campCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();

      res.send(result);
    });

    // get my added camp count related api

    app.get("/my-added-camp-count/:email", async (req, res) => {
      const email = req.params.email;

      const query = {
        organizerEmail: email,
      };

      const result = await campCollection.countDocuments(query);
      res.send({ result });
    });

    // get camp request related api

    app.get("/manage-camp-request/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        organizerEmail: email,
      };
      const result = await participantDetailsCollection
        .aggregate([
          {
            $addFields: { campIdAsObjectid: { $toObjectId: "$campId" } },
          },
          {
            $lookup: {
              from: "camp",
              localField: "campIdAsObjectid",
              foreignField: "_id",
              as: "campDetails",
            },
          },
          {
            $addFields: {
              campDetails: { $arrayElemAt: ["$campDetails", 0] },
            },
          },
          {
            $match: {
              organizerEmail: email,
            },
          },
          {
            $sort: { _id: -1 },
          },
          {
            $project: {
              campIdAsObjectid: 0,
              campId: 0,
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // get camp request count related api

    app.get("/manage-camp-request-count/:email", async (req, res) => {
      const email = req.params.email;

      const query = {
        organizerEmail: email,
      };

      const result = await participantDetailsCollection.countDocuments(query);
      res.send({ result });
    });

    // update confirmation status related api
    app.patch("/update-confirmation-status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          confirmationStatus: status,
        },
      };
      const result = await participantDetailsCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    // update camp related api

    app.put("/update-camp/:id", async (req, res) => {
      const id = req.params.id;
      const camp = req.body;

      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          ...camp,
        },
      };

      const result = await campCollection.updateOne(filter, updateDoc, option);
      res.send(result);
    });

    // delete camp related api

    app.delete("/delete-my-camp/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await campCollection.deleteOne(query);
      res.send(result);
    });

    // my registered camp related api

    app.get("/my-registered-camp/:email", async (req, res) => {
      const email = req.params.email;
      const result = await participantDetailsCollection
        .aggregate([
          {
            $match: { participantEmail: email },
          },
          {
            $addFields: { campObjectId: { $toObjectId: "$campId" } },
          },
          {
            $lookup: {
              from: "camp",
              localField: "campObjectId",
              foreignField: "_id",
              as: "campDetailsObject",
            },
          },
          {
            $addFields: {
              campDetailsObject: { $arrayElemAt: ["$campDetailsObject", 0] },
            },
          },
          {
            $project: {
              campObjectId: 0,
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // count my added camp

    app.get("/count-my-added-camp/:email", async (req, res) => {
      const email = req.params.email;

      const query = { participantEmail: email };

      const result = await participantDetailsCollection.countDocuments(query);

      res.send({ result });
    });

    // post user data in database related api created

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
      const query = req.query;
      const numberOfUsersPerPage = parseInt(query.numberOfUsersPerPage);
      const currentPage = parseInt(query.currentPage);
      let filter = {};
      if (query.searchByName) {
        filter.name = { $regex: query.searchByName, $options: "i" };
      }
      if (query.searchByEmail) {
        filter.email = { $regex: query.searchByEmail, $options: "i" };
      }
      const result = await usersCollection
        .find(filter)
        .sort({ _id: -1 })
        .skip(numberOfUsersPerPage * currentPage)
        .limit(numberOfUsersPerPage)
        .toArray();
      res.send(result);
    });

    app.get("/user-count", async (req, res) => {
      const query = req.query;
      let filter = {};
      if (query.searchByName) {
        filter.name = { $regex: query.searchByName, $options: "i" };
      }
      if (query.searchByEmail) {
        filter.email = { $regex: query.searchByEmail, $options: "i" };
      }
      const result = await usersCollection.estimatedDocumentCount(filter);
      res.send({ result });
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

    // payment methods

    app.post("/create-payment-intent", async (req, res) => {
      const { campFee } = req.body;

      const amount = parseInt(campFee * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "BDT",
        payment_method_types: ["card"],
      });

      res.send({ clientSecret: paymentIntent.client_sercret });
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
