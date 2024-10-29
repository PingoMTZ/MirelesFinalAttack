const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");

const User = require("./model/User");
const Project = require("./model/Projects");
const Task = require("./model/Tasks");
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

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect("/"); // Redirect to login page if not logged in
}

app.use((req, res, next) => {
    res.set("Cache-Control", "no-store"); // Prevent caching
    next();
});

// LogOut Function
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out:", err);
            return res.status(500).send("Error logging out. Please try again.");
        }
        res.clearCookie("connect.sid"); // Clear session cookie
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

// New Login
app.post("/", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        
        if (!user) {
            return res.status(404).send("User not found");
        }

        const passwordMatch = await bcrypt.compare(req.body.password, user.password);
        
        if (passwordMatch) {
            req.session.user = user._id; // Store user ID in the session
            res.redirect("/proyects"); // Redirect to projects page
        } else {
            res.send("Incorrect username or password");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Error during login. Please try again.");
    }
});

// Register page display
app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { username, email, password, question, answer } = req.body;

    // Check for existing users
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
        return res.status(400).send('Username or email already exists.');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const hashedAnswer = await bcrypt.hash(answer, saltRounds);

    const data = {
        username,
        email,
        password: hashedPassword,
        question,
        answer: hashedAnswer,
        projects: [], // Start with an empty projects array
        tasks: []
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

// Recover password page display
app.get("/recoverpwd", (req, res) => {
    res.render("recoverpwd"); // Renderiza el formulario inicial de recuperación
});

// Procesar username y email para recuperación de contraseña
app.post("/recoverpwd", async (req, res) => {
    const { username, email } = req.body;
    const user = await User.findOne({ username, email });

    if (!user) {
        return res.status(404).send("User not found or email does not match.");
    }

    // Almacenar temporalmente el ID del usuario en la sesión para el siguiente paso
    req.session.recoverUserId = user._id;
    res.render("securityquestion", { question: user.question });
});

// Ruta para mostrar formulario de nueva contraseña tras responder correctamente la pregunta de seguridad
app.post("/recoverpwd/verify", async (req, res) => {
    const { answer } = req.body;
    const userId = req.session.recoverUserId;

    if (!userId) {
        return res.status(400).send("Session expired. Please try again.");
    }

    const user = await User.findById(userId);
    const answerMatch = await bcrypt.compare(answer, user.answer);

    if (answerMatch) {
        // Si la respuesta es correcta, redirige a un formulario para cambiar la contraseña
        res.render("resetpassword");
    } else {
        res.status(400).send("Incorrect answer.");
    }
});

// Ruta para procesar el restablecimiento de contraseña
app.post("/resetpassword", async (req, res) => {
    const { newPassword } = req.body;
    const userId = req.session.recoverUserId;

    if (!userId) {
        return res.status(400).send("Session expired. Please try again.");
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualiza la contraseña del usuario en la base de datos
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    // Limpia la sesión y notifica al usuario
    req.session.recoverUserId = null;
    req.session.message = "Your password has been successfully reset. You can now log in with your new password.";
    res.redirect("/");
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
app.get("/changeuser", isAuthenticated, (req, res) => {
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
app.get("/delete", isAuthenticated, (req, res) => {
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
app.get("/proyects", isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user; // Obtén el ID del usuario desde la sesión
        // CHANGES MADE HERE, no using popoulate
        // const user = await User.findById(userId); // Obtener el usuario por su ID

        const user = await User.findById(userId).populate("projects");

        if (!user) {
            return res.status(404).send("User not found");
        }

        const projects = user.projects || []; // Asegurarse de que haya proyectos, si no, usar un array vacío

        // Pasar 'projects' como se espera en el archivo EJS
        res.render("proyects", { userId, projects });
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).send("Error fetching projects.");
    }
});

app.get("/project/:projectId", async (req, res) => {
    const { projectId } = req.params;

    try {
        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).send("Project not found");
        }

        res.render("tasks", { project });
    } catch (error) {
        console.error("Error fetching project tasks:", error);
        res.status(500).send("Error fetching project tasks.");
    }
});

// Create projects page display
app.get("/createprojects", isAuthenticated, (req, res) => {
    const userId = req.session.user;
    res.render("createprojects",{userId});
});

app.put("/proyecto", async (req, res) => {
    const { userId, proyecto } = req.body;

    const formattedProject = {
        ...proyecto,
        startDate: new Date(proyecto.startDate),
        endDate: new Date(proyecto.endDate),
        administrator: userId // Set the administrator as the current user
    };

    try {
        // Create the project in the Project collection
        const newProject = await Project.create(formattedProject);

        // Then, push the project's ObjectId into the user's `projects` array
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $push: { projects: newProject._id } },
            { new: true }
        );

        res.status(200).json({ message: 'Proyecto guardado con éxito', user: updatedUser });
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ message: 'Error al guardar el proyecto. Intenta de nuevo más tarde.' });
    }
});

app.post("/deleteProject", async (req, res) => {
    const { userId, projectId } = req.body;

    try {
        // First, remove the project from the Project collection
        await Project.findByIdAndDelete(projectId);

        // Then, remove the project's reference from the user's projects array
        await User.findByIdAndUpdate(
            userId,
            { $pull: { projects: projectId } },
            { new: true }
        );

        res.redirect("/proyects");
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