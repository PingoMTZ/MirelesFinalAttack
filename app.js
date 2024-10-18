const express = require('express');
const session = require('express-session');
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
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'ejs');


app.get("/", (req, res) => {
    res.render("login");
});

// CHANGES HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!
app.get("/logout", (req, res) => {
    // Destroy the session to log the user out
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out:", err);
            return res.status(500).send("Error logging out. Please try again.");
        }
        res.redirect("/"); // Redirect to the login page after logout
    });
});

app.post("/", async (req, res) => {
    try{
        const user = await User.findOne({username: req.body.username});
        if(!user){
            return res.status(404).send("User not found");
        }
        
        const passwordMatch = await bcrypt.compare(req.body.password, user.password);
        if(passwordMatch){
            req.session.user = user._id;
            const userId = req.session.user;
            res.render("proyects",{userId});
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
    const { username, email, password } = req.body;

    // Check for existing users
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
        return res.status(400).send('Username or email already exists.');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const data = {
        username,
        email,
        password: hashedPassword,
        projects: [] // Start with an empty projects array
    };

    try {
        const userData = await User.create(data);
        res.status(201).send('User registered successfully');
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(400).send('Error registering user: ' + error.message);
    }

    /*
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    const data = {
        username: req.body.username,
        email: req.body.email,
        password: hashedPassword,
        project: []
    };

    try {
        const userData = await User.create(data); 
        console.log("registered succesfully");
        res.render("login");
        // res.status(201).send('User registered successfully');
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).send('Username or email already exists.');
        } else {
            console.error("Error registering user:", error);
            res.status(400).send('Error registering user: ' + error.message);
        }
    }
    */
});

// Ruta 
app.get('/changepwd', (req, res) => {
    res.render("changepwd");
});

// Cambiar contraseña
app.put("/changepwd", async (req, res) => {
    try {
        // Buscar al usuario por el nombre de usuario
        const user = await User.findOne({ username: req.body.username });
        if (!user) {
            return res.status(404).send("User not found");
        }

        // Verifica la contraseña antigua
        const passwordMatch = await bcrypt.compare(req.body.oldPassword, user.password);
        if (!passwordMatch) {
            return res.status(400).send("Old password is incorrect");
        }

        // Genera un nuevo hash para la nueva contraseña
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(req.body.newPassword, saltRounds);

        // Actualizar la contraseña usando findByIdAndUpdate
        await User.findByIdAndUpdate(user._id, { password: hashedNewPassword });

        res.send("Password updated successfully");
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).send("Error changing password");
    }
});

app.get("/changeuser", (req, res) => {
    res.render("changeuser");
});


// Cambiar usuario
app.put("/changeuser", async (req, res) => {
    try {
        

        // Buscar al usuario por el nombre de usuario
        const user = await User.findOne({ username: req.body.oldUsername });
        if (!user) {
            return res.status(404).send("User not found");
        }

        // Verifica la contraseña 
        const passwordMatch = await bcrypt.compare(req.body.password, user.password);
        if (!passwordMatch) {
            return res.status(400).send("Password is incorrect");
        }

        // Actualizar la contraseña usando findByIdAndUpdate
        await User.findByIdAndUpdate(user._id, { username: req.body.newUsername });

        res.send("Username updated successfully");
    } catch (error) {
        console.error("Error changing username:", error);
        res.status(500).send("Error changing username");
    }
});

app.get("/delete", (req, res) => {
    res.render("delete");
});

// Borrar usuario
app.put("/delete", async (req, res) => {
    try {
        

        // Buscar al usuario por el nombre de usuario
        const user = await User.findOne({ username: req.body.username });
        if (!user) {
            return res.status(404).send("User not found");
        }

        // Verifica la contraseña 
        const passwordMatch = await bcrypt.compare(req.body.password, user.password);
        if (!passwordMatch) {
            return res.status(400).send("Password is incorrect");
        }

        // Actualizar la contraseña usando findByIdAndUpdate
        await User.deleteOne(user._id);

        res.send("Username deleted successfully");
    } catch (error) {
        console.error("Error deleting username:", error);
        res.status(500).send("Error deleting username");
    }
});

//agregar proyecto (FEO)
app.put("/proyecto", async (req, res) => {
    const { userId, proyecto } = req.body; // Asegúrate de que el cuerpo tenga esta estructura
    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $push: { project: proyecto } },
            { new: true }
        );
        res.status(200).json({ message: 'Proyecto guardado con éxito', user: updatedUser });
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ message: 'Error al guardar el proyecto. Intenta de nuevo más tarde.' });
    }
});

app.get("/proyects", (req, res) => {
    res.render("proyects");
});

app.get("/createprojects", (req, res) => {
    const userId = req.session.user;
    res.render("createprojects",{userId});
});

const port = process.env.PORT || 5001;

connectToDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running on ${port}`);
    });
}).catch(error => {
    console.error("Failed to connect to the database:", error);
});