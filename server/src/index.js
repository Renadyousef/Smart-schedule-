// src/index.js
import app from './app.js'; // use import and include .js

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
