const express = require('express')
const redis = require('redis');
const { promisify } = require('util');
const MongoDbDriver = require('mongodb');
const app = express();

require('dotenv').config();

const uri = process.env.MONGODB;
const { MongoClient } = MongoDbDriver;
const mongoDb = new MongoClient(uri.toString(), {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const redisClient = redis.createClient();
redisClient.on('connect', function(){
  console.log('Connected to redis server');
});

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);

app.use(express.json());
const port = 3000;
let db;

app.post('/addUser', async(req, res) => {
  try{
  const {mobile, name, email, city} = req.body;
  await db.collection('redisuser').updateOne(
    {mobile},
    {$set: {
      ...req.body
    }},
    {upsert: true}
  )
  await setAsync(`${mobile}:name`, name);
  await setAsync(`${mobile}:email`, email);
  await setAsync(`${mobile}:city`, city);
  res.send({success: true});
  } catch(err) {
    throw err;
  }
})

app.post('/getUserCache', async(req, res) => {
  const { mobile } = req.body;
  const userData = await getAsync(`${mobile}:name`);
  if(!userData) {
    const data = await db.collection('redisuser').findOne(
      {mobile}
    )
    if(data) {
      res.send(data);
    }
    if(!data) {
      res.send('User doesn\'t exists');
    }
  }
  if(userData){
    const name = await getAsync(`${mobile}:name`);
    const email = await getAsync(`${mobile}:email`);
    const city = await getAsync(`${mobile}:city`);
    res.send({
      mobile, name, city, email
    })
  }
})

app.post('/getUserDB', async(req, res) => {
  const { mobile } = req.body;
  const data = await db.collection('redisuser').findOne(
    {mobile}
  )
  if(data) {
    res.send(data);
  }
  if(!data){
    res.send('User doesn\'t exists');
  }
})

app.post('/updateEmail', async(req, res) => {
  const { mobile, email } = req.body;
  const {modifiedCount} = await db.collection('redisuser').updateOne(
    {mobile},
    {$set: {
      email
    }}
  )
  if(modifiedCount){
    await setAsync(`${mobile}:email`, email);
    res.send({success: true, newEmail: email});
  }else {
    res.send({success: false});
  }
})

app.post('/updateEmailCache', async(req, res) => {
  const { mobile, email } = req.body;
  await setAsync(`${mobile}:email`, email);
  res.send({success: true, newEmail: email});
})

app.post('/updateEmailDB', async(req, res) => {
  const { mobile, email } = req.body;
  const {modifiedCount} = await db.collection('redisuser').updateOne(
    {mobile},
    {$set: {
      email
    }}
  )
  if(modifiedCount){
    res.send({success: true, newEmail: email});
  }else {
    res.send({success: false});
  }
})

app.post('/deleteUser', async(req, res) => {
  const { mobile } = req.body;
  const {deletedCount} = await db.collection('redisuser').deleteOne(
    {mobile}
  )
  if(deletedCount){
    await delAsync(`${mobile}:name`);
    await delAsync(`${mobile}:email`);
    await delAsync(`${mobile}:city`);
    res.send({success: true});
  }else {
    res.send({success: false});
  }
})

app.listen(port, async() => {
  await mongoDb.connect();
  db = mongoDb.db('zeus');
  console.log('Connected successfully to server');
})