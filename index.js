let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const { DATABASE_URL } = process.env;

let app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true,
  },
});

async function getPostgresVersion() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT version()");
    console.log(res.rows[0]);
  } finally {
    client.release();
  }
}

getPostgresVersion();

app.post("/signup", async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_uid, actual_name } = req.body;
    console.log("User UID:", user_uid);
    console.log("User UID:", actual_name);

    // Check if user_uid is already taken
    const userResult = await client.query(
      "SELECT * FROM users WHERE user_uid =$1",
      [user_uid],
    );
    if (userResult.rows.length > 0) {
      return res.status(400).json({ message: "User UID already taken." });
    }

    // Insert user_uid into users table
    await client.query(
      "INSERT INTO users (user_uid, actual_name) VALUES ($1,$2)",
      [user_uid, actual_name],
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get("/extractname/:user_uid", async (req, res) => {
  const { user_uid } = req.params;
  console.log(`Received request for user_uid: ${user_uid}`);
  const client = await pool.connect();
  try {
    console.log("Connected to the database");
    const query = `
SELECT actual_name
FROM users
WHERE user_uid = $1;
    `;
    console.log("Executing query:", query);
    const actualName = await client.query(query, [user_uid]);

    if (actualName.rowCount > 0) {
      console.log("Actual name found:", actualName.rows);
      res.json(actualName.rows);
    } else {
      console.log("No actualName data found for user_uid:", user_uid);
      res.status(404).json({ error: "No actualName data found" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/* app.post("/login", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT * FROM users WHERE username = $1",
      [req.body.username],
    );
    const user = result.rows[0];
    if (!user)
      return res
        .status(400)
        .json({ message: "Username or password incorrect" });
    const passwordIsValid = await bcrypt.compare(
      req.body.password,
      user.password,
    );
    if (!passwordIsValid)
      return res.status(401).json({ auth: false, token: null });

    var token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, {
      expiresIn: 86400,
    });

    res.status(200).json({ auth: true, token: token });
  } catch (error) {
    console.error(`Error: `, error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}); */

/*************************************************************************************************/


app.post("/addmovies", async (req, res) => {
  const { user_Review, date_Watched, user_uid } = req.body;

  console.log("Received movie details:", {
    user_Review,
    date_Watched,
    user_uid,
  });

  const client = await pool.connect();
  try {
    const post = await client.query(
      "INSERT INTO movies (personal_review, date_watched, user_uid) VALUES ($1, $2, $3) RETURNING *",
      [user_Review, date_Watched, user_uid],
    );
    res.json(post.rows[0]);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get("/moviedetails/user/:user_uid", async (req, res) => {
  const { user_uid } = req.params;
  const client = await pool.connect();
  try {
    //
    const query = `
    SELECT movies.* FROM movies 
    INNER JOIN users ON movies.user_uid = users.user_uid
    WHERE users.user_uid = $1
    ORDER BY movies.movie_id ASC;
    `;
    const movies = await client.query(query, [user_uid]);

    if (movies.rowCount > 0) {
      res.json(movies.rows);
    } else {
      res.status(404).json({ error: "No movie data found" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get("/moviereviews/:imdb_id", async (req, res) => {
  const { imdb_id } = req.params;
  console.log('Receive imdb_id for movieReviewsAndName:', imdb_id)
  const client = await pool.connect();
  try {
    const query = `
SELECT  users.actual_name, movies.personal_review
FROM movies
INNER JOIN users ON movies.user_uid = users.user_uid
WHERE movies.imdb_id = $1;
    `;
    const reviews = await client.query(query, [imdb_id]);
    console.log("Retrieved reviews from the database:", reviews.rows);

    if (reviews.rowCount > 0) {
      res.json(reviews.rows);
    } else {
      res.status(404).json({ error: "No reviews found for this movie" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/* app.post('/addmoviefromOMDB', async (req, res) => {
  const { movie_poster, movie_name, movie_year } = req.body;

  console.log("Received OMDB movie details:", { movie_poster, movie_name, movie_year });

  const client = await pool.connect();
  try {
    const post = await client.query('INSERT INTO movies (movie_poster, movie_name, movie_year ) VALUES ($1, $2, $3) RETURNING *', [movie_poster, movie_name, movie_year]);
    res.json(post.rows[0]);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}); */

app.post("/addallmoviedetails", async (req, res) => {
  const {
    movie_poster,
    movie_name,
    movie_year,
    movie_rating,
    user_Review,
    date_Watched,
    user_uid,
    imdb_id,
  } = req.body;

  console.log("Received movie details:", {
    movie_poster,
    movie_name,
    movie_year,
    movie_rating,
    user_Review,
    date_Watched,
    user_uid,
    imdb_id
  });

  const client = await pool.connect();
  try {
    const post = await client.query(
      "INSERT INTO movies (movie_poster, movie_name, movie_year, movie_rating, personal_review,  date_watched, user_uid, imdb_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        movie_poster,
        movie_name,
        movie_year,
        movie_rating,
        user_Review,
        date_Watched,
        user_uid,
        imdb_id
      ],
    );
    res.json(post.rows[0]);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete("/delete/:movie_id", async (req, res) => {
  const { movie_id } = req.params;
  console.log("Delete movie ID for Delete:", movie_id);
  const client = await pool.connect();
  try {
    const deleteQuery = "DELETE FROM movies WHERE movie_id = $1";
    await client.query(deleteQuery, [movie_id]);
    res.json({
      idReplit: parseInt(movie_id),
      message: "Selected Movie has been deleted successfully",
    });
  } catch (err) {
    console.log(err.stack);
    res
      .status(500)
      .json({ error: "Something went wrong, please try again later!" });
  } finally {
    client.release();
  }
});

app.put("/movies/:movie_id", async (req, res) => {
  const { movie_id } = req.params;
  console.log("Received movie ID for Update:", movie_id);
  const updatedData = req.body;
  const client = await pool.connect();
  try {
    const updateQuery =
      "UPDATE movies SET personal_review = $1, date_watched = $2, movie_rating = $3 WHERE movie_id = $4 returning *";
    const newData = [
      updatedData.personal_review,
      updatedData.date_watched,
      updatedData.movie_rating,
      movie_id,
    ];
    await client.query(updateQuery, newData);
    const response = await client.query(updateQuery, newData);
    console.log(response);
    res.json({
      newData: response.rows[0],
      status: "success",
      message: "Movie review updated successfully",
    });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/*************************************************************************************************/

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the Movie Database API" });
});

app.listen(3000, () => {
  console.log("App is listening to port 3000");
});
