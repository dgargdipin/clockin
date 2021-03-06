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
const axios = require('axios');
const { response } = require('express');
const { MongoNetworkTimeoutError } = require('mongodb');

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
    id: String,
    title: String,
    rrule: {
        dtstart: String,
        freq: String,
        until: String
    },
    start: String,
    duration: String,
    time: String,
    url: String,
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
    events: [eventsSchema],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);


var currentid = "";

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

let email = "";

passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3003/auth/google/clockin",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        passReqToCallback: true,

    },
    function(req, accessToken, refreshToken, profile, cb) {
        console.log(profile);
        currentid = profile.id;
        email = profile.emails[0].value;

        User.findOrCreate({ username: profile.emails[0].value, googleId: profile.id, picture: profile.photos[0].value, fname: profile.displayName }, function(err, user) {
            req.session.accessToken = accessToken;
            req.session.refreshToken = refreshToken
            return cb(err, user);
        });
    }
));



app.route("/")
    .get((req, res) => {
        res.render('home');
    });

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', "email", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"] }));

app.get("/auth/google/clockin",
    passport.authenticate('google', { failureRedirect: "/" }),
    function(req, res) {
        res.redirect("/calendar");
    });


app.get("/calendar", function(req, res) {
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
        User.findOne({ googleId: currentid }, async function(err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {
                    foundUser.toObject();
                    var newEvents = [];
                    var vnone = [];
                    var vmisc = [];
                    var vbday = [];
                    var vofficial = [];
                    var vunofficial = [];

                    for (let i = 0; i < foundUser.events.length; i++) {
                        if (foundUser.events[i].description === 'none') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = 0;
                                if (n === 1) { k = 2 } else if (n === 2) { k = 3 } else if (n === 3) { k = 4 } else if (n === 4) { k = 5 } else if (n === 5) { k = 6 } else if (n === 6) { k = 7 } else if (n === 0) { k = 1 }
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 0;


                                if (m === 1) { k = 2 } else if (m === 2) { k = 3 } else if (m === 3) { k = 4 } else if (m === 4) { k = 5 } else if (m === 5) { k = 6 } else if (m === 6) { k = 7 } else if (m === 7) { k = 8 } else if (m === 8) { k = 9 } else if (m === 9) { k = 10 } else if (m === 10) { k = 11 } else if (m === 11) { k = 12 } else { k = 1 }
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vnone.push(`{` + `"` + foundUser.events[i].start + `"` + `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'official') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = 0;
                                if (n === 1) { k = 2 } else if (n === 2) { k = 3 } else if (n === 3) { k = 4 } else if (n === 4) { k = 5 } else if (n === 5) { k = 6 } else if (n === 6) { k = 7 } else if (n === 0) { k = 1 }
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 0;
                                if (m === 1) { k = 2 } else if (m === 2) { k = 3 } else if (m === 3) { k = 4 } else if (m === 4) { k = 5 } else if (m === 5) { k = 6 } else if (m === 6) { k = 7 } else if (m === 7) { k = 8 } else if (m === 8) { k = 9 } else if (m === 9) { k = 10 } else if (m === 10) { k = 11 } else if (m === 11) { k = 12 } else { k = 1 }
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vofficial.push(`{` + `"` + foundUser.events[i].start + `"` + `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'unofficial') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = 0;
                                if (n === 1) { k = 2 } else if (n === 2) { k = 3 } else if (n === 3) { k = 4 } else if (n === 4) { k = 5 } else if (n === 5) { k = 6 } else if (n === 6) { k = 7 } else if (n === 0) { k = 1 }
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 0;
                                if (m === 1) { k = 2 } else if (m === 2) { k = 3 } else if (m === 3) { k = 4 } else if (m === 4) { k = 5 } else if (m === 5) { k = 6 } else if (m === 6) { k = 7 } else if (m === 7) { k = 8 } else if (m === 8) { k = 9 } else if (m === 9) { k = 10 } else if (m === 10) { k = 11 } else if (m === 11) { k = 12 } else { k = 1 }
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vunofficial.push(`{` + `"` + foundUser.events[i].start + `"` + `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'bday') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = 0;
                                if (n === 1) { k = 2 } else if (n === 2) { k = 3 } else if (n === 3) { k = 4 } else if (n === 4) { k = 5 } else if (n === 5) { k = 6 } else if (n === 6) { k = 7 } else if (n === 0) { k = 1 }
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 0;
                                if (m === 1) { k = 2 } else if (m === 2) { k = 3 } else if (m === 3) { k = 4 } else if (m === 4) { k = 5 } else if (m === 5) { k = 6 } else if (m === 6) { k = 7 } else if (m === 7) { k = 8 } else if (m === 8) { k = 9 } else if (m === 9) { k = 10 } else if (m === 10) { k = 11 } else if (m === 11) { k = 12 } else { k = 1 }
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vbday.push(`{` + `"` + foundUser.events[i].start + `"` + `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'misc') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = 0;
                                if (n === 1) { k = 2 } else if (n === 2) { k = 3 } else if (n === 3) { k = 4 } else if (n === 4) { k = 5 } else if (n === 5) { k = 6 } else if (n === 6) { k = 7 } else if (n === 0) { k = 1 }
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 0;
                                if (m === 1) { k = 2 } else if (m === 2) { k = 3 } else if (m === 3) { k = 4 } else if (m === 4) { k = 5 } else if (m === 5) { k = 6 } else if (m === 6) { k = 7 } else if (m === 7) { k = 8 } else if (m === 8) { k = 9 } else if (m === 9) { k = 10 } else if (m === 10) { k = 11 } else if (m === 11) { k = 12 } else { k = 1 }
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].rrule.until + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vmisc.push(`{` + `"` + foundUser.events[i].start + `"` + `}`);
                            }

                        }

                    }
                    let calendarList;
                    let event;
                    let actualEvent;
                    try {
                        calendarList = await axios.get("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
                            headers: {
                                'Authorization': `Bearer ${req.session.accessToken}`
                            }
                        });
                    } catch (err) {
                        throw new Error('No calendar list');
                    }
                    // console.log(response.data.items)
                    if (!calendarList.data) return res.render("calendar", { idpic: foundUser.picture, idname: foundUser.fname, events: foundUser.events, vnone: vnone, vofficial: vofficial, vunofficial: vunofficial, vbday: vbday, vmisc: vmisc });
                    let l = calendarList.data.items.length;
                    // console.log(l)
                    for (let i = 0; i < l; i++) {
                        let Cid = calendarList.data.items[i].id;
                        try {
                            event = await axios.get('https://www.googleapis.com/calendar/v3/calendars/' + Cid + '/events', {
                                headers: {
                                    'Authorization': `Bearer ${req.session.accessToken}`
                                }
                            });

                        } catch (err) {
                            continue;
                        }


                        // console.log(response.data.items.length);

                        for (let j = 0; j < event.data.items.length; j++) {
                            let id = '';
                            id = event.data.items[j].id;


                            try {
                                actualEvent = await axios.get('https://www.googleapis.com/calendar/v3/calendars/' + Cid + '/events/' + id, {
                                    headers: {
                                        'Authorization': `Bearer ${req.session.accessToken}`
                                    }
                                })

                            } catch (err) {
                                continue;
                            }
                            // console.log(response)
                            let obj = {};
                            obj["title"] = actualEvent.data.summary;
                            obj["id"] = actualEvent.data.id;
                            obj["rrule"] = {
                                dtstart: actualEvent.data.start.date,
                                until: actualEvent.data.end.date,
                            }
                            obj["start"] = actualEvent.data.start;
                            obj["time"] = "08:00";
                            obj["allDay"] = false;
                            newEvents.push(obj);
                            console.log("Object pushed into newEvents\n", newEvents.length)
                                // console.log(obj);
                                // _id: String,
                                // id: String,
                                // title: String,
                                // rrule: {
                                //     dtstart: String,
                                //     freq: String,
                                //     until: String
                                // },
                                // start: String,
                                // duration: String,
                                // time: String,
                                // url: String,
                                // allDay: Boolean,
                                // startRecur: String,
                                // endRecur: String,
                                // description: String  
                                //CANNOT CONSOLE LOG NEWEVENTS OUTSIDE AXIOS.GET



                        }
                        // console.log(newEvents);
                        //newEvents.concat(actualEvent.data.items[i]);


                    }





                    console.log("New Events before rendering\n", newEvents);
                    res.render("calendar", { idpic: foundUser.picture, idname: foundUser.fname, events: foundUser.events, vnone: vnone, vofficial: vofficial, vunofficial: vunofficial, vbday: vbday, vmisc: vmisc });
                }
            }
        });
    } else {
        res.redirect('/');
    }
});
let descp = "";
let dte = "";
let tm = "";

var vnone = [];
app.post("/calendar", function(req, res) {
    const title = req.body.title;
    const date = req.body.date;
    const time = req.body.time;
    const link = req.body.link;
    const id = new Date;
    let dtstart;
    let freq;
    let until;
    const description = req.body.description;
    const repeat = req.body.repeat;
    if (req.body.repeat !== "none") {
        dtstart = req.body.date;
        freq = req.body.repeat;
        until = req.body.until;

    };
    tm = req.body.time;
    let min = "";
    let hr = "";
    let mnth = "";
    let wk = "";

    hr = tm[0] + tm[1];
    min = tm[3] + tm[4];
    dt = req.body.date[8] + req.body.date[9];
    mnth = req.body.date[5] + req.body.date[6];

    wk = id.getDay();


    const output = `
    <h3>You have a new event scheduled !!</h3>
    <h2 style="font-size:2em">Event Details</h2>
      <p style="font-size:1.2em"><b>Description:</b> ${req.body.title}</p>
      <p style="font-size:1.2em"><b>Date:</b> ${req.body.date}</p>
      <p style="font-size:1.2em"><b>Time:</b> ${req.body.time}</p>
      <p>You will receive a reminder before the start of the scheduled event.</p>
      <p>This is an auto-generated mail. Please do not reply.</p>
  `;

    const remind = `
    <h3>Reminder !!</h3>
    <h2 style="font-size:2em">Event Details</h2>
      <p style="font-size:1.2em"><b>Description:</b> ${req.body.title}</p>
      <p style="font-size:1.2em"><b>Date:</b> ${req.body.date}</p>
      <p style="font-size:1.2em"><b>Time:</b> ${req.body.time}</p>
      <p>This is an auto-generated mail. Please do not reply.</p>    
  `;

    let transporter = nodemailer.createTransport({
        service: 'gmail',

        port: 587,
        secure: false,
        auth: {
            user: 'clockin.india@gmail.com',
            pass: 'vahi_wahi'
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    let mailOptions = {
        from: '"ClockIn India" <clockin.india@gmail.com>',
        to: email,
        subject: 'Event Created',
        text: 'Hello world?',
        html: output
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

        res.render('contact', { msg: 'Email has been sent' });
    });


    const event = new Event({
        title: title,
        start: date,
        time: time,
        url: link,
        _id: id,
        id: id,
        duration: '01:00',
        allDay: false,
        description: description,
        rrule: {
            dtstart: dtstart + 'T' + time + ':00',
            freq: freq,
            until: until
        },

    })

    User.findOne({ googleId: currentid }, function(err, foundUser) {
        foundUser.events.push(event);
        foundUser.save();
        res.redirect("/calendar");
    });


    cron.schedule(min + " " + hr + " " + dt + " " + mnth + " " + '*', function() {

        let mailOptions = {
            from: '"ClockIn India" <clockin.india@gmail.com>',
            to: email,
            subject: 'Reminder',
            text: 'Hello world?',
            html: remind,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: %s', info.messageId);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

            res.render('contact', { msg: 'Email has been sent' });
        });
    });

});

app.post("/delete", function(req, res) {
    const idi = req.body.idi;
    User.findOne({ googleId: currentid }, function(err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            let vuser = foundUser.events.id(idi);
            foundUser.events.pull({ id: idi });
            foundUser.save();
            res.redirect('/calendar');

            dte = vuser.start;
            dte = `'` + dte + `'`
            descp = vuser.description;
        }
    })

});


app.listen(3003, () => {
    console.log('CONNECTION ESTABLISHED ON PORT 3003')
});