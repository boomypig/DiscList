const express = require('express');
const cors = require('cors');

const model = require('./model'); // ./model this directory where all the functions for database go 
const session = require('express-session');
const { Model } = require('mongoose');
const multer = require("multer");
const { S3Client, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
app.use(express.json()); //using json data
app.use(cors())
app.use(express.static('public'));


function authorizeUser (req,res,next){
    // next is the next middleware or the function(one of the routes)
    if (req.session && req.session.userId){
        // checks if user is authenticated
        model.User.findOne({
            _id: req.session.userId
        }).then(function(user){
            req.user = user; 
            next();
        })
    }else{
        res.sendStatus(401);
    }
};
// Admin authorization middleware
function authorizeAdmin(req, res, next) {
    // First check if the user is authenticated
    if (req.session && req.session.userId) {
        // Find the user
        model.User.findOne({
            _id: req.session.userId
        }).then(function(user) {
            if (user && user.isAdmin) {
                // User is an admin, allow access
                req.user = user;
                next();
            } else {
                // User is not an admin
                res.status(403).json({
                    error: "Unauthorized: Admin access required"
                });
            }
        }).catch(function(error) {
            console.log("Error finding user:", error);
            res.sendStatus(500);
        });
    } else {
        // User is not authenticated
        res.status(401).json({
            error: "Authentication required"
        });
    }
}

// AWS S3 Configuration
const s3 = new S3Client({
  region: "us-west-2", 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

const BUCKET_NAME = "vinylphotos"; //  bucket name


app.use(session({
    secret: process.env.SESSION_SEC,
    saveUninitialized:true,
    resave: false

}))

//--------------------- web app function endpoints----------------------
//endpoint to get all vinyls 
app.get('/vinyls',function(req,res){
    model.Vinyl.find({}).then((vinyls) => {
        res.json(vinyls);
    }).catch(error => {
        console.log(error)
    })
});

// Update  vinyl creation endpoint to accept the image URL
app.post('/vinyls',authorizeAdmin, function(req, res) {
    let newVinyl = new model.Vinyl({
        vinylCover: req.body.vinylCover, 
        vinylVersion: req.body.vinylVersion,
        album: req.body.album,
        artist: req.body.artist,
        upc: req.body.upc,
        songs: req.body.songs || 0
    });
    
    newVinyl.save().then(() => {
      res.status(201).json({ success: true, vinyl: newVinyl });
    }).catch((error) => {
        if (error.errors){
            let errorMessages = {};
            for (let field in error.errors){
                errorMessages[field] = error.errors[field].message;
            }
            res.status(422).json(errorMessages);
        } else {
            console.log("Failed to save new vinyl", error);
            res.sendStatus(500);
        }
    });
});

app.delete('/vinyls/:vinylId', function(req, res){
    model.Vinyl.findOne({
        _id: req.params.vinylId  
    }).then(function(vinyl){
        if(vinyl){
            model.Vinyl.deleteOne({
                _id: req.params.vinylId
            }).then(function(){
                res.sendStatus(200)
            }).catch(function(error){
                console.log("Error deleting vinyl:", error);
                res.sendStatus(500);
            });
        } else {
            res.status(404).json({
                error: "Vinyl not found"
            });
        }
    }).catch(function(error){
        console.log("Error finding vinyl:", error);
        res.sendStatus(500);
    });
});

app.put('/vinyls/:vinylId', authorizeAdmin, function(req, res){
    model.Vinyl.findOne({
        _id: req.params.vinylId
    }).then(function(vinyl){
        if(!vinyl){
            return res.status(404).json({
                error: "Vinyl not found"
            });
        }
        
        // Update fields
        vinyl.vinylCover = req.body.vinylCover;
        vinyl.vinylVersion = req.body.vinylVersion;
        vinyl.album = req.body.album;
        vinyl.artist = req.body.artist;
        vinyl.upc = req.body.upc;
        vinyl.songs = req.body.songs || 0;
        
        vinyl.save().then(function(){
            res.status(200).json({
                success: true,
                vinyl: vinyl
            });
        }).catch(function(error){
            if (error.errors){
                let errorMessages = {};
                for (let field in error.errors){
                    errorMessages[field] = error.errors[field].message;
                }
                res.status(422).json(errorMessages);
            } else {
                console.log("Failed to update vinyl", error);
                res.sendStatus(500);
            }
        });
    }).catch(function(error){
        console.log("Error finding vinyl for update:", error);
        res.sendStatus(500);
    });
});

//for image uploading the best way would be to upload the image first and then 
// save the url of where that image was saved put it into the paramaters of the vinyl 
// schema and save the url and when retreivng the vinyl it'll be easier to retrieve the image
//too since the image url will be saved withe vinyl

app.post("/upload-image",authorizeAdmin, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileKey = `vinyl-covers/${Date.now()}-${req.file.originalname}`;

  try {
    // Upload file to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const imageUrl = `https://${BUCKET_NAME}.s3.us-west-2.amazonaws.com/${fileKey}`;
    console.log("Uploaded image URL:", imageUrl);

    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Error uploading to S3:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});


//--------------------- end of web app function endpoints----------------------

//---------------------  User function endpoints ------------------------------

app.post('/users',function(req,res){
    let newUser = new model.User({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        userName: req.body.userName
    });
    console.log("1")
    newUser.SetEncryptedPass(req.body.plainPass).then(function(){
        console.log('6')
        newUser.save().then(() => {
            console.log('7 user is made')
            res.status(201).send("Created")
        }).catch((error) => {
            console.log("failed to save new user", error)
            res.status(401).send("Unable to create new user")
        });
    }).catch(error => {
        console.log("promise not fullfilled", error)
    });
});

// app.post('/create-admin', function(req, res) {
//     let newAdmin = new model.User({
//         firstName: req.body.firstName,
//         lastName: req.body.lastName,
//         email: req.body.email,
//         userName: req.body.userName,
//         isAdmin: true
//     });
    
//     newAdmin.SetEncryptedPass(req.body.plainPass).then(function() {
//         newAdmin.save().then(() => {
//             res.status(201).json({
//                 message: "Admin user created successfully"
//             });
//         }).catch((error) => {
//             console.log("Failed to save admin user", error);
//             res.status(500).json({
//                 error: "Failed to create admin user"
//             });
//         });
//     }).catch(error => {
//         console.log("Password encryption failed", error);
//         res.status(500).json({
//             error: "Password encryption failed"
//         });
//     });
// });




app.get('/session',authorizeUser, function(req,res){
    console.log("current user session", req.session)
    res.json(req.user);
});

app.post('/session', function(req, res) {
    model.User.findOne({
        email: req.body.email
    }).then(function(user) {
        if (!user) {
            return res.sendStatus(401); // User not found
        }
        
        user.verifyEncryptedPassword(req.body.plainPass).then(function(verified) {
            console.log("promise caught", verified);
            if (verified) { 
                req.session.userId = user._id; 
                res.sendStatus(201);
            } else {
                res.sendStatus(401);
            }
        }).catch(error => {
            console.log("Error verifying password:", error);
            res.sendStatus(500);
        });
    }).catch(error => {
        console.log("Error finding user:", error);
        res.sendStatus(500);
    });
});

app.delete('/session', function(req, res){
    req.session.userId = null
    res.sendStatus(200)
});
//---------------------   End of User function endpoints ----------------------




app.listen(8080,function(){
    console.log("Server is ready on port 8080")
})