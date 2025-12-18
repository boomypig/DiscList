# DiscList - Vinyl Record Collection Web App

## Overview
DiscList is a web application for vinyl record enthusiasts to catalog, track, and share their vinyl collections. The application allows users to browse records, create personal collections, maintain want lists, and (for admins) manage the record database.

website URL: 
https://disklist-0c5x.onrender.com/

figma URL: 
https://www.figma.com/design/paPig7Atemq2SUMG7gYDiI/DiscList?node-id=0-1&t=WbnsSX1SfU1VLs7a-1

## Features

### User Features
- **Account Management**: Sign up and log in securely
- **Record Browsing**: View all vinyl records in the database
- **Search Functionality**: Find records by album, artist, or version
- **Personal Collection**: Add records to your collection
- **Want List**: Keep track of records you want to acquire

### Admin Features
- **Record Management**: Add, edit, and delete vinyl records
- **Image Upload**: Upload album cover images to AWS S3
- **Data Control**: Maintain the database of vinyl records

## Technology Stack

### Frontend
- **Vue.js**: Frontend framework for building the user interface
- **HTML/CSS**: Structure and styling of the application
- **Font Awesome**: Icons for an improved user experience

### Backend
- **Node.js**: JavaScript runtime for the server
- **Express**: Web application framework for Node.js
- **MongoDB**: NoSQL database for storing application data
- **Mongoose**: MongoDB object modeling for Node.js
- **bcrypt**: Password hashing for secure authentication
- **AWS S3**: Cloud storage for vinyl cover images

## Project Structure

### Frontend Files
- **index.html**: Main HTML structure of the application
- **style.css**: Styling for the application
- **app.js**: Vue.js application code

### Backend Files
- **index.js**: Main server file with API endpoints
- **model.js**: Database models and schemas

## API Endpoints

### Vinyl Records
- `GET /vinyls`: Get all vinyl records
- `POST /vinyls`: Create a new vinyl record (admin only)
- `PUT /vinyls/:vinylId`: Update a vinyl record (admin only)
- `DELETE /vinyls/:vinylId`: Delete a vinyl record

### User Authentication
- `POST /users`: Create a new user account
- `POST /session`: Log in user
- `GET /session`: Check current session
- `DELETE /session`: Log out user

### File Upload
- `POST /upload-image`: Upload an album cover image (admin only)

## Security Features
- **Password Encryption**: User passwords are hashed with bcrypt
- **Session Management**: Secure user sessions
- **Role-Based Access**: Admin-only features are protected
- **Authentication Middleware**: Routes are protected as needed

## Local Storage
The application uses the browser's local storage to maintain:
- User's collection of vinyl records
- User's want list
- User's ratings of records (couldn't get to work)
