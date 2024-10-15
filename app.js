const express = require('express');
const path = require("path");
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");
const User = require("./model/User")
require('dotenv').config();

const uri = process.env.DB_URI;
const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

async function connectToDatabase() {
    try {
        // Establish the database connection
        await mongoose.connect(uri, clientOptions);
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
        console.error("Connection error:", error);
        process.exit(1); // Exit the application if unable to connect
    }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'ejs');

app.get("/", (req, res) => {
    res.render("login");
});

app.post("/", async (req, res) => {
    try{
        const user = await User.findOne({username: req.body.username});
        if(!user){
            return res.status(404).send("User cannot be found");
        }
        
        const passwordMatch = await bcrypt.compare(req.body.password, user.password);
        if(passwordMatch){
            res.render("proyects");
        }else{
            res.send("wrong data input");
        }
    }catch{
        res.send("wrong details");
    };
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    const data = {
        username: req.body.username,
        email: req.body.email,
        password: hashedPassword
    };

    try {
        const userData = await User.create(data); 
        console.log(userData);
        res.status(201).send('User registered successfully');
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).send('Username or email already exists.');
        } else {
            console.error("Error registering user:", error);
            res.status(400).send('Error registering user: ' + error.message);
        }
    }
});

// Ruta de cierre de sesión
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send('Error al cerrar sesión');
        }
        res.send('Sesión cerrada');
    });
});

// Ruta para comprobar si el usuario está autenticado
app.get('/proyects', (req, res) => {
    if (req.session.user) {
        res.send('Bienvenido, ${req.session.user}');
    } else {
        res.send('Debes iniciar sesión primero');
    }
});


const port = process.env.PORT || 5001;

connectToDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running on ${port}`);
    });
}).catch(error => {
    console.error("Failed to connect to the database:", error);
});