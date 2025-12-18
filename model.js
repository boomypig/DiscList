require('dotenv').config()
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {promise} = require('bcrypt/promises');

//uri helping connect to my mongo db
const MONGODB_URI= `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@${process.env.MONGODB_DBCLUSTER}/?retryWrites=true&w=majority&appName=${process.env.MONGODB_APPNAME}`
mongoose.connect(MONGODB_URI,{
    dbName: process.env.MONGODB_DBNAME
});

//model for vinyl data
const Vinyl = mongoose.model('Vinyl',{
    vinylCover:{
        type: String  // This will store the S3 image URL
    },
    vinylVersion:{
        type: String
    },
    album:{
        type: String
    },
    artist: {
        type:String
    },
    songs:{
        type:Number
    }, 
    upc:{
        type:Number
    },
});
//blue print for user data 
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true, 

    },
    lastName: {
        type: String,
        required: true, 

    },
    email: {
        type: String,
        required: true, 

    },
    userName: {
        type: String,
        required: true, 

    },
    encryptedPassword: {
        type: String,
        required: true, 

    },
    isAdmin: {
        type: Boolean,
        default: false,  // Most users are not admins by default
    }
});;

userSchema.methods.SetEncryptedPass = function(plainPass){
    console.log('2')
    let promise = new Promise((resolve, reject) => {
        // the promise is a function 
        //the reslove and rejcet are also functions and resolve is what fullfills the promise
        console.log(plainPass)
        console.log('3')
        bcrypt.hash(plainPass,12).then((hash) => {
            console.log('4')
            console.log("Hashed PW: ", hash);
            this.encryptedPassword = hash;
            console.log('5 pass is encrypted')
            resolve()
        })
    })
    return promise
}

userSchema.methods.verifyEncryptedPassword = function(plainpass){
    let promise = new Promise((resolve, reject) => {
        bcrypt.compare(plainpass, this.encryptedPassword).then(result => {
            resolve(result);
        })
    })
    return promise
}

const User = mongoose.model('User', userSchema)

module.exports = {
    Vinyl,
    User
}