const express = require('express');
const session = require('express-session');
const path = require("path");
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");

const User = require("./model/User");
const User = require("./model/Projects");
const User = require("./model/Tasks");

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
    cookie: {
        maxAge: 60000
    }
}));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'ejs');

// LogOut Function
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

// Login page display
app.get("/", (req, res) => {
    const message = req.session.message;
    
    // Clear the session message after displaying it
    req.session.message = null;
    
    res.render("login", { message });
});

// Login function
app.post("/", async (req, res) => {
    try{
        const user = await User.findOne({username: req.body.username});
        if(!user){
            return res.status(404).send("User not found");
        }
        
        const passwordMatch = await bcrypt.compare(req.body.password, user.password);
        if (passwordMatch) {
            req.session.user = user._id; // Asegura que el ID del usuario esté correctamente guardado en la sesión
            const userId = req.session.user;
            const projects = user.project || []; // Obtener los proyectos del usuario
            res.render("proyects", { userId, projects });
        }else{
            res.send("wrong data input");
        }
    }catch{
        res.send("wrong details");
    };
});

// Register page display
app.get("/register", (req, res) => {
    res.render("register");
});

// Register function
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
        await User.create(data);
        
        // Set a success message in the session
        req.session.message = "User registered successfully";
        
        // Redirect to login
        res.redirect("/");
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(400).send('Error registering user: ' + error.message);
    }
});


// Change password page display
app.get('/changepwd', (req, res) => {
    res.render("changepwd");
});

// Change password function
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

// Change user page display
app.get("/changeuser", (req, res) => {
    res.render("changeuser");
});

// Change user function
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

// Delete user page display
app.get("/delete", (req, res) => {
    res.render("delete");
});

// Delete user function
app.put("/delete", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (!user) {
            return res.status(404).send("User not found");
        }

        const passwordMatch = await bcrypt.compare(req.body.password, user.password);
        if (!passwordMatch) {
            return res.status(400).send("Password is incorrect");
        }

        // Eliminar el usuario de la base de datos
        await User.deleteOne({ _id: user._id });

        // Destruir la sesión
        req.session.destroy((err) => {
            if (err) {
                console.error("Error logging out:", err);
                return res.status(500).send("Error logging out. Please try again.");
            }
            // Redirigir a la página de login
            res.status(200).json({ message: "User deleted successfully" });
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send("Error deleting user");
    }
});

// Projects page display
app.get("/proyects", async (req, res) => {
    try {
        const userId = req.session.user; // Obtén el ID del usuario desde la sesión
        const user = await User.findById(userId); // Obtener el usuario por su ID

        if (!user) {
            return res.status(404).send("User not found");
        }

        const projects = user.project || []; // Asegurarse de que haya proyectos, si no, usar un array vacío

        // Pasar 'projects' como se espera en el archivo EJS
        res.render("proyects", { userId, projects });
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).send("Error fetching projects.");
    }
});

// Display projects in page function
app.get("/project/:projectId", async (req, res) => {
    const userId = req.session.user; // Obtener el ID del usuario desde la sesión
    const { projectId } = req.params;

    try {
        const user = await User.findById(userId); // Obtener el usuario por su ID

        if (!user) {
            return res.status(404).send("User not found");
        }

        const project = user.project.find(p => p._id.toString() === projectId); // Buscar el proyecto por ID

        if (!project) {
            return res.status(404).send("Project not found");
        }

        res.render("tasks", { project }); // Renderizar la vista de tareas
    } catch (error) {
        console.error("Error fetching project tasks:", error);
        res.status(500).send("Error fetching project tasks.");
    }
});

// Create projects page display
app.get("/createprojects", (req, res) => {
    const userId = req.session.user;
    res.render("createprojects",{userId});
});

// Create proyect function (DEPRECATED)
app.put("/proyecto", async (req, res) => {
    const { userId, proyecto } = req.body;

    // Convertir las fechas a UTC y eliminar la hora
    const startDate = new Date(proyecto.startDate).toISOString().split('T')[0];
    const endDate = new Date(proyecto.endDate).toISOString().split('T')[0];

    const formattedProject = {
        ...proyecto,
        startDate: new Date(startDate), // Fecha sin hora
        endDate: new Date(endDate)      // Fecha sin hora
    };

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $push: { project: formattedProject } },
            { new: true }
        );
        res.status(200).json({ message: 'Proyecto guardado con éxito', user: updatedUser });
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ message: 'Error al guardar el proyecto. Intenta de nuevo más tarde.' });
    }
});

// Delete projects function
app.post("/deleteProject", async (req, res) => {
    const { userId, projectId } = req.body;

    try {
        // Buscar al usuario por ID y eliminar el proyecto específico
        await User.findByIdAndUpdate(
            userId,
            { $pull: { project: { _id: projectId } } },
            { new: true }
        );

        res.redirect("/proyects"); // Redirige de nuevo a la lista de proyectos después de eliminar
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).send("Error deleting project. Please try again.");
    }
});

// Star server functions
const port = process.env.PORT || 5001;

connectToDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running on ${port}`);
    });
}).catch(error => {
    console.error("Failed to connect to the database:", error);
});