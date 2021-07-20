//jshint esversion:6
require('dotenv').config();
const cron = require('node-cron');
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const MongoClient = require("mongodb").MongoClient;
const nodemailer = require('nodemailer');

const app = express();


app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our liitle secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/UserDB", { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);



const eventsSchema = new mongoose.Schema({
    _id: String,
 
    title: String,
    rrule:{
        dtstart: String,
        freq : String,
        until: String 
    },
    date: String,
    time: String,
    link:String,
    allDay: Boolean,
    startRecur: String,
    endRecur: String,
    description: String


})

const Event = new mongoose.model("Event", eventsSchema)

const userSchema = new mongoose.Schema({
    googleId: String,
    username: String,
    picture: String,
    fname: String,
    events:[eventsSchema],
    nones: Array,
    officials: Array,
    unofficials: Array,
    bdays: Array,
    miscs: Array
    
}, /*{timestamps: true}*/);

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);


var currentid = "";

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

let email="";

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3003/auth/google/clockin",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        currentid = profile.id;
        email=profile.emails[0].value;

        User.findOrCreate({ username: profile.emails[0].value, googleId: profile.id, picture: profile.photos[0].value, fname: profile.displayName }, function (err, user) {
            return cb(err, user);
        });
    }
));



app.route("/")
    .get((req, res) => {
        res.render('home');
    });

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', "email"] }));

app.get("/auth/google/clockin",
    passport.authenticate('google', { failureRedirect: "/" }),
    function (req, res) {
        res.redirect("/calendar");
    });


app.get("/calendar", function (req, res) {
    //     User.findOne({ "secret": { $ne: null } }, function (err, foundUsers) {
    //         if (err) {
    //             console.log(err);
    //         } else {
    //             if (foundUsers) {
    // res.render("calendar", { usersWithSecrets: foundUsers });
    // res.render("calendar");
    //             }
    //         }
    //     });
    // }

    if (req.isAuthenticated()) {
        User.findOne({ googleId: currentid }, function (err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {

                    foundUser.toObject();
                    res.render("calendar", { idpic: foundUser.picture, idname: foundUser.fname, events: foundUser.events, nones: foundUser.nones, officials: foundUser.officials,unofficials: foundUser.unofficials, bdays: foundUser.bdays, miscs: foundUser.miscs});
                }
            }
        });
    }
    else {
    res.redirect('/');
    }
});

let tm="";

app.post("/calendar", function(req, res){

    const title = req.body.title;
    const date = req.body.date;
    const time = req.body.time;
    const link = req.body.link;
    const id= new Date;
    let dtstart;
    let freq;
    let until;
    const description= req.body.description;
    const repeat = req.body.repeat;
    if(req.body.repeat!=="none")
    {
    dtstart= req.body.date;
    freq= req.body.repeat;
    until=req.body.until;

    };
    tm=req.body.time;
    let min="";
    let hr="";
    let mnth="";
    let wk="";

    hr=tm[0]+tm[1];
    min=tm[3]+tm[4];
    console.log(hr);
    dt=req.body.date[8]+req.body.date[9];
    mnth=req.body.date[3]+req.body.date[4];

    wk=id.getDay();


    const output = `
    <h3>You have a new event scheduled !!</h3>
    <h2 style="font-size:2em">Event Details</h2>
      <p style="font-size:1.2em"><b>Description:</b> ${req.body.title}</p>
      <p style="font-size:1.2em"><b>Date:</b> ${req.body.date}</p>
      <p style="font-size:1.2em"><b>Time:</b> ${req.body.time}</p>
      <p>You will receive a reminder 15 minutes before the scheduled event.</p>
      <p>This is an auto-generated mail. Please do not reply.</p>
  `;

  const remind = `
    <h3>Remind !!</h3>
    <h2 style="font-size:2em">Event Details</h2>
      <p style="font-size:1.2em"><b>Description:</b> ${req.body.title}</p>
      <p style="font-size:1.2em"><b>Date:</b> ${req.body.date}</p>
      <p style="font-size:1.2em"><b>Time:</b> ${req.body.time}</p>
      <p>This is an auto-generated mail. Please do not reply.</p>    
  `;

  let transporter = nodemailer.createTransport({
      service:'gmail',

    port: 587,
    secure: false, 
    auth: {
        user: 'clockin.india@gmail.com',
        pass: 'vahi_wahi' 
    },
    tls:{
      rejectUnauthorized:false
    }
  });

  let mailOptions = {
      from: '"ClockIn India" <clockin.india@gmail.com>', 
      to: email, 
      subject: 'Node Contact Request',
      text: 'Hello world?',
      html: output
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          return console.log(error);
      }
      console.log('Message sent: %s', info.messageId);   
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

      res.render('contact', {msg:'Email has been sent'});
  });
  

    const event = new Event({
        title: title,
        date: date,
        time: time,
        link: link,
        _id:id,
        allDay:false,
        description:description,
        rrule:
        {dtstart:dtstart,
            freq:freq,
            until:until
        },

    })

    
      User.findOne({ googleId: currentid }, function(err, foundUser){
        foundUser.events.push(event);
        if(description==='none')
            foundUser.nones.push(`'`+date.toString()+`'`);
        else if(description==='official')
            foundUser.officials.push(`'`+date.toString()+`'`);
        else if(description==='unofficial')
            foundUser.unofficials.push(`'`+date.toString()+`'`);
        else if(description==='bday')
            foundUser.bdays.push(`'`+date.toString()+`'`);
        else
            foundUser.miscs.push(`'`+date.toString()+`'`);
        foundUser.save();
        res.redirect("/calendar");
      });

       cron.schedule('* ' + min +" " +hr+" " +dt + " " +mnth+" " +'*' , function() {
   
        let mailOptions = {
            from: '"ClockIn India" <clockin.india@gmail.com>', 
            to: email, 
            subject: 'Node Contact Request',
            text: 'Hello world?', 
            html: remind, 
        };
      
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: %s', info.messageId);   
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      
            res.render('contact', {msg:'Email has been sent'});
        });
    });

  });


app.listen(3003, () => {
    console.log('CONNECTION ESTABLISHED ON PORT 3003')
});
