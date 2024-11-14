const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");

const User = require("./model/User");
const Project = require("./model/Projects");
const Task = require("./model/Tasks");
const Tasks = require('./model/Tasks');
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
    },
    rolling: true
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
        req.session.message = "Usuario registrador exitosamente";
        
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
app.get('/changepwd', isAuthenticated, (req, res) => {
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

       // Step 1: Find projects where the user is the administrator
       const adminProjects = await Project.find({ administrator: user._id });

       // Step 2: Collect task IDs from these projects
       const taskIdsToDelete = [];
       for (const project of adminProjects) {
           taskIdsToDelete.push(...project.tasks); // Collect tasks from projects
       }
       
       // Step 3: Delete the tasks
       await Task.deleteMany({ _id: { $in: taskIdsToDelete } });

       // Step 4: Delete the projects
       await Project.deleteMany({ administrator: user._id });

        // Step 2: Remove user from projects where they are a member
        await Project.updateMany(
            { members: user._id },
            { $pull: { members: user._id } }
        );

        
        // Step 3: Delete the user
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

app.get("/project/:projectId", isAuthenticated, async (req, res) => {
    const { projectId } = req.params;

    try {
        // Populate both tasks and users within each task
        const project = await Project.findById(projectId)
            .populate({
                path: "tasks",
                populate: {
                    path: "users", // Assuming 'users' is a reference to User schema in each task
                    select: "username" // Only select the 'name' field from each user
                }
            });

        if (!project) {
            return res.status(404).send("Project not found");
        }

        const userId = req.session.user; 

        res.render("tasks", { project, tasks: project.tasks, userId });
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

// Ruta para mostrar la página de edición de proyecto
app.get("/project/edit/:projectId", isAuthenticated, async (req, res) => {
    const { projectId } = req.params;

    try {
        const project = await Project.findById(projectId);
        
        if (!project) {
            return res.status(404).send("Project not found");
        }

        res.render("editproject", { project });
    } catch (error) {
        console.error("Error fetching project for edit:", error);
        res.status(500).send("Error fetching project. Please try again.");
    }
});

// Ruta para actualizar los datos del proyecto
app.post("/project/edit/:projectId", async (req, res) => {
    const { projectId } = req.params;
    const { name, description, startDate, endDate } = req.body;

    try {
        await Project.findByIdAndUpdate(projectId, {
            name,
            description,
            startDate: new Date(startDate),
            endDate: new Date(endDate)
        });

        res.redirect("/proyects"); // Redirige a la lista de proyectos tras guardar
    } catch (error) {
        console.error("Error updating project:", error);
        res.status(500).send("Error updating project. Please try again.");
    }
});

app.post("/deleteProject", async (req, res) => {
    const { userId, projectId } = req.body;
    try {
        const project = await Project.findById(projectId);
        // First, remove the project from the Project collection
        await Project.findByIdAndDelete(projectId);

        await User.findByIdAndUpdate(
            userId,
            { $pull: { projects: projectId } },
            { new: true } 
        );

        await User.updateMany(
            { _id: { $in: project.members } }, 
            { $pull: { projects: projectId } }
        );    

        // Remove all tasks associated with this project
        await Task.deleteMany({ _id: { $in: project.tasks } });        

        res.redirect("/proyects");
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).send("Error deleting project. Please try again.");
    }
    
});

// Create Task
app.post("/tasks", async (req, res) => {
    const { projectId, taskTitle, taskDescription, priority, progress, startDate, endDate, timeEstimation, comments} = req.body;
    
    try {
        // Creates a new task
        const newTask = new Task({
            name: taskTitle,
            description: taskDescription,
            priority,
            progress,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            timeEstimation,
            comments,
            users: [],
            project: projectId
        });

        await newTask.save();

        // Adds the task ID to the project task array
        await Project.findByIdAndUpdate(projectId, { $push: { tasks: newTask._id } });

        // Redirect or responds with a success message
        res.redirect(`/project/${projectId}`);
    } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).send("Error creating task. Please try again.");
    }
});


app.get("/createTask/:projectId", isAuthenticated, async (req, res) => {
    const { projectId } = req.params;

    try {
        const project = await Project.findById(projectId);

        if(!project) {
            return res.status(404).send("Project was not found");
        }

        res.render("createTask", { project }); // Passes the project to createTask.ejs
    } catch (error) {
        console.error("Error fetching project:", error);
        res.status(500).send("Error fetching project.");
    }
});

app.get("/addMember/:projectId", isAuthenticated, async (req, res) => {
    const { projectId } = req.params;

    try {
        const project = await Project.findById(projectId).populate('members');
        
        if (!project) {
            return res.status(404).send("Project not found");
        }

        const projectMemberIds = project.members.map(member => member._id);
        const availableUser = await User.find({ _id: {  $nin: projectMemberIds } });

        res.render("addMember", { projectId, availableUser });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Error fetching users");
    }
});

app.post('/addMember', async (req, res) => {
    const { projectId, username, email } = req.body;

    try {
        // Find the user by username or email
        const user = await User.findOne({ username, email });

        if (!user) {
            return res.status(400).send('User not found');
        }

        // Find the project by its ID
        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(400).send('Project not found');
        }

        // Add the user to the project's member list
        project.members.push(user._id);
        await project.save();

        await Project.findByIdAndUpdate(projectId, { $addToSet: { members: user._id } });

        await User.findByIdAndUpdate(user._id, { $addToSet: { projects: projectId } });


        // Redirect to the project page
        res.redirect(`/project/${projectId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding member');
    }
});

// Funciones para los nuevos botones en el view de task
app.get("/task/edit/:taskId", isAuthenticated, async (req, res) => {
    const { taskId } = req.params; // Retrieve taskId from the URL
    const { projectId } = req.query; // Retrieve projectId from query parameters
    const userId = req.session.user;
    
    try {
        const task = await Task.findById(taskId);
        const project = await Project.findById(projectId);

        if (!task) {
            return res.status(404).send("Task was not found");
        }

        if (!project) {
            return res.status(404).send("Project was not found");
        }

        res.render("editTask", { userId, task, project }); // Pass the task and projectId to the view
    } catch (error) {
        console.error("Error fetching task:", error);
        res.status(500).send("Error fetching task.");
    }
});

// Aqui va el app.post para edit task
app.post("/task/edit/:taskId", isAuthenticated, async (req, res) => {
    const { taskId } = req.params;
    const { projectId, name, description, priority, progress, startDate, endDate, timeEstimation, comments } = req.body;

    try {
        if (!req.session.user) {
            return res.status(401).send("Usuario no autenticado.");
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).send("Proyecto no encontrado.");
        }

        const isAdmin = project.administrator.toString() === req.session.user.toString();

        const updates = isAdmin
            ? { name, description, priority, progress, timeEstimation, comments }
            : { comments }; // Solo permitir comentarios si no es administrador

        if (isAdmin) {
            if (startDate) updates.startDate = new Date(startDate);
            if (endDate) updates.endDate = new Date(endDate);
        }

        await Task.findByIdAndUpdate(taskId, updates);
        res.redirect(`/project/${projectId}`);
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).send("Error updating task. Please try again.");
    }
});





app.post("/task/delete/:taskId", async (req, res) => {
    const { taskId } = req.params; // Retrieve taskId from the URL
    const { projectId } = req.body; // Retrieve projectId from body

    try {
        // Find the task to ensure it exists
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).send("Task not found");
        }

        // Update the project by removing the task reference
        await Project.findByIdAndUpdate(projectId, { $pull: { tasks: taskId } });

        // Update users by removing the task reference from their tasks array
        await User.updateMany(
            { _id: { $in: task.users } }, // Find all users assigned to this task
            { $pull: { tasks: taskId } }   // Remove the task from their tasks array
        );

        // Delete the task from the database
        await Task.findByIdAndDelete(taskId);

        // Redirect to the project tasks view or send a success message
        res.redirect(`/project/${projectId}`);
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).send("Error while deleting task. Please try again.");
    }
});

// Display view
app.get("/task/addMember/:taskId", isAuthenticated, async (req, res) => {
    const { taskId } = req.params; // Retrieve taskId from the URL
    const { projectId } = req.query; // Retrieve projectId from query parameters

    try {
        const task = await Task.findById(taskId);
        const project = await Project.findById(projectId).populate("members");

        const availableUsers = project.members;

        res.render("addTaskMember", { task, projectId, availableUsers: availableUsers}); // Pass the task and projectId to the view
    } catch (error) {
        console.error("Error fetching task or project:", error);
        res.status(500).send("Error fetching task or project.");
    }
});

app.post("/addTaskMember/:taskId", async (req, res) => {
    try {
        // Use `userId` from the form submission, not `member`
        const { userId } = req.body;  // Get userId from the form submission
        
        // Find the user by their `userId`
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { taskId } = req.params;

        // Add the task to the user's tasks array
        await User.findByIdAndUpdate(userId, { $addToSet: { tasks: taskId } });

        // Add the user to the task's users array
        await Task.findByIdAndUpdate(taskId, { $addToSet: { users: userId } });

        // Send a success response
        res.status(200).json({ message: "Member added to the task successfully." });
    } catch (error) {
        console.error("Add member error:", error);
        res.status(500).json({ error: "Error while adding member. Please try again." });
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