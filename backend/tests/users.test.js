/** @jest-environment node */

require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");

const MONGO_URI = process.env.MONGO_URI;

beforeAll(async () => {
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 3000,
    runtimeAdapters: {
      os: require("os"),
    },
  });

  console.log("Connected to MongoDB for testing");
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("GET /users", () => {
  test("should return status 200 and an array", async () => {
    const response = await request(app).get("/users");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
