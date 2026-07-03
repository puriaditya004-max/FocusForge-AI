// ---------------------------------------------------------
// roadmap.controller.js — Smart Timetable / 25-week curriculum
// ---------------------------------------------------------
// The curriculum content itself is fixed (same for every
// student). What's dynamic per-user is only the `status`
// of each week (UPCOMING / IN_PROGRESS / COMPLETED).
//
// On first fetch, if a user has no roadmap items yet, we
// auto-seed all 25 weeks for them (one time only).
// ---------------------------------------------------------
const prisma = require("../config/db");

// Master curriculum data — same for every student.
// This mirrors the `weeklyPlan` array from Timetable.jsx.
const CURRICULUM = [
  { week: 1, monthNumber: 1, monthLabel: "Month 1 – Python & Basics", title: "Python Setup, Syntax, Variables, Data Types, Operators, Input/Output", tools: "Python", hours: "6-8 Hrs", project: "Simple Calculator" },
  { week: 2, monthNumber: 1, monthLabel: "Month 1 – Python & Basics", title: "Lists, Tuples, Sets, Dictionaries, Conditions, Loops", tools: "Python", hours: "6-8 Hrs", project: "To-Do List App" },
  { week: 3, monthNumber: 1, monthLabel: "Month 1 – Python & Basics", title: "Functions, Recursion, Lambda, Modules, File Handling", tools: "Python", hours: "6-8 Hrs", project: "File Organizer" },
  { week: 4, monthNumber: 1, monthLabel: "Month 1 – Python & Basics", title: "OOP (Classes, Objects, Inheritance, Polymorphism)", tools: "Python", hours: "6-8 Hrs", project: "OOP Based App" },
  { week: 5, monthNumber: 1, monthLabel: "Month 1 – Python & Basics", title: "Numpy Basics, Pandas Basics, Matplotlib, Seaborn", tools: "NumPy, Pandas, Matplotlib, Seaborn", hours: "6-8 Hrs", project: "Data Analysis (EDA)" },

  { week: 6, monthNumber: 2, monthLabel: "Month 2 – Machine Learning", title: "Statistics (Mean, Median, Mode, Variance, Prob.)", tools: "Maths + Python", hours: "6-8 Hrs", project: "Statistics Calculator" },
  { week: 7, monthNumber: 2, monthLabel: "Month 2 – Machine Learning", title: "Data Preprocessing (Missing Data, Encoding, Scaling, Normalization)", tools: "Pandas, Sklearn", hours: "6-8 Hrs", project: "Data Cleaning App" },
  { week: 8, monthNumber: 2, monthLabel: "Month 2 – Machine Learning", title: "Linear Regression (Simple & Multiple)", tools: "Sklearn", hours: "6-8 Hrs", project: "House Price Prediction" },
  { week: 9, monthNumber: 2, monthLabel: "Month 2 – Machine Learning", title: "Logistic Regression, KNN, Decision Tree", tools: "Sklearn", hours: "6-8 Hrs", project: "Classification Project" },
  { week: 10, monthNumber: 2, monthLabel: "Month 2 – Machine Learning", title: "Random Forest, SVM, Model Evaluation, Cross Validation", tools: "Sklearn", hours: "6-8 Hrs", project: "ML Model Comparison" },

  { week: 11, monthNumber: 3, monthLabel: "Month 3 – Deep Learning", title: "Introduction to Neural Networks", tools: "TensorFlow / Keras", hours: "6-8 Hrs", project: "ANN Model" },
  { week: 12, monthNumber: 3, monthLabel: "Month 3 – Deep Learning", title: "CNN (Convolution Neural Network)", tools: "TensorFlow / Keras", hours: "6-8 Hrs", project: "Image Classifier" },
  { week: 13, monthNumber: 3, monthLabel: "Month 3 – Deep Learning", title: "RNN & LSTM Basics", tools: "TensorFlow / Keras", hours: "6-8 Hrs", project: "Text Prediction" },
  { week: 14, monthNumber: 3, monthLabel: "Month 3 – Deep Learning", title: "Model Training, Hyperparameter Tuning", tools: "TensorFlow / Keras", hours: "6-8 Hrs", project: "Improved Model" },
  { week: 15, monthNumber: 3, monthLabel: "Month 3 – Deep Learning", title: "Model Deployment (Saving, Loading, Flask Basics)", tools: "Flask, Python", hours: "6-8 Hrs", project: "Deployed Model" },

  { week: 16, monthNumber: 4, monthLabel: "Month 4 – AI Advanced & GenAI", title: "NLP Basics (Text Processing, Tokenization)", tools: "NLTK, SpaCy", hours: "6-8 Hrs", project: "Text Analyzer" },
  { week: 17, monthNumber: 4, monthLabel: "Month 4 – AI Advanced & GenAI", title: "Transformers Basics (BERT, GPT)", tools: "Hugging Face", hours: "6-8 Hrs", project: "Sentiment Analysis" },
  { week: 18, monthNumber: 4, monthLabel: "Month 4 – AI Advanced & GenAI", title: "LLM Basics & Prompt Engineering", tools: "OpenAI API", hours: "6-8 Hrs", project: "AI Prompt App" },
  { week: 19, monthNumber: 4, monthLabel: "Month 4 – AI Advanced & GenAI", title: "LangChain Basics", tools: "LangChain", hours: "6-8 Hrs", project: "Ask PDF Bot" },
  { week: 20, monthNumber: 4, monthLabel: "Month 4 – AI Advanced & GenAI", title: "Final Project (AI + ML + Deployment)", tools: "All Combined", hours: "6-8 Hrs", project: "AI Assistant App" },

  { week: 21, monthNumber: 5, monthLabel: "SE Month 1 – DSA & Basics", title: "DSA: Arrays, Strings, Linked Lists, Stacks, Queues, Trees, Sorting", tools: "Python / JS", hours: "6-8 Hrs", project: "LeetCode Practice" },

  { week: 22, monthNumber: 6, monthLabel: "SE Month 2 – Web Development", title: "HTML, CSS, JavaScript, React.js Basics", tools: "HTML, CSS, JS, React", hours: "6-8 Hrs", project: "Portfolio Website" },
  { week: 23, monthNumber: 6, monthLabel: "SE Month 2 – Web Development", title: "React.js Advanced + Build Projects", tools: "React", hours: "6-8 Hrs", project: "React App" },

  { week: 24, monthNumber: 7, monthLabel: "SE Month 3 – Backend", title: "Node.js / Express.js, MongoDB + SQL, REST API, Authentication", tools: "Node.js, MongoDB", hours: "6-8 Hrs", project: "Full Stack App" },
  { week: 25, monthNumber: 7, monthLabel: "SE Month 3 – Backend", title: "Git & GitHub, Deployment (Vercel/Render), Postman, System Design", tools: "Git, Vercel", hours: "6-8 Hrs", project: "Deployed Full Stack Project" },
];

// Helper: reshape a Prisma roadmap item -> frontend format
const formatItem = (item) => ({
  week: item.weekNumber,
  month: item.monthLabel,
  topic: item.title,
  tools: item.tools || "",
  hours: item.hours || "",
  project: item.project || "",
  status: item.status,
});

// GET /api/roadmap
// Returns all 25 weeks for the logged-in user.
// Auto-seeds the curriculum on first-ever fetch for that user.
const getRoadmap = async (req, res) => {
  try {
    const userId = req.user.userId;

    let items = await prisma.roadmapItem.findMany({
      where: { userId },
      orderBy: { weekNumber: "asc" },
    });

    // First time this user is opening Smart Timetable — seed it
    if (items.length === 0) {
      await prisma.roadmapItem.createMany({
        data: CURRICULUM.map((c) => ({
          userId,
          weekNumber: c.week,
          monthNumber: c.monthNumber,
          monthLabel: c.monthLabel,
          title: c.title,
          tools: c.tools,
          hours: c.hours,
          project: c.project,
        })),
      });

      items = await prisma.roadmapItem.findMany({
        where: { userId },
        orderBy: { weekNumber: "asc" },
      });
    }

    res.status(200).json(items.map(formatItem));
  } catch (err) {
    console.error("getRoadmap error:", err);
    res.status(500).json({ message: "Failed to fetch roadmap" });
  }
};

// PATCH /api/roadmap/:week/status
// Updates the status of a single week (UPCOMING / IN_PROGRESS / COMPLETED)
const updateWeekStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const weekNumber = parseInt(req.params.week, 10);
    const { status } = req.body;

    const validStatuses = ["UPCOMING", "IN_PROGRESS", "COMPLETED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const existing = await prisma.roadmapItem.findFirst({
      where: { userId, weekNumber },
    });
    if (!existing) {
      return res.status(404).json({ message: "Week not found" });
    }

    const updated = await prisma.roadmapItem.update({
      where: { id: existing.id },
      data: { status },
    });

    res.status(200).json(formatItem(updated));
  } catch (err) {
    console.error("updateWeekStatus error:", err);
    res.status(500).json({ message: "Failed to update week status" });
  }
};

module.exports = {
  getRoadmap,
  updateWeekStatus,
};