// ---------------------------------------------------------
// certificateQuestions.js — Server-side question bank for
// Certificate Exams, keyed by topic.
//
// IMPORTANT: this file (and its `answer` field) must NEVER be
// sent to the client. certificate.controller.js strips the
// `answer` field before responding to GET /questions, and
// scoring in POST /submit is computed here on the server.
// This is what makes the certificate result trustworthy.
// ---------------------------------------------------------

const CERTIFICATE_QUESTIONS = {
  "Python – Month 1 Foundations": [
    { id: 1, type: "theory", q: "Which of the following is NOT a valid Python data type?", options: ["int", "float", "char", "bool"], answer: 2 },
    { id: 2, type: "theory", q: "What will `type(3.0)` return?", options: ["<class 'int'>", "<class 'float'>", "<class 'double'>", "<class 'number'>"], answer: 1 },
    { id: 3, type: "theory", q: "Which keyword is used to define a function in Python?", options: ["function", "define", "def", "fun"], answer: 2 },
    { id: 4, type: "theory", q: "What is the output of `print(10 // 3)`?", options: ["3.33", "3", "4", "1"], answer: 1 },
    { id: 5, type: "theory", q: "Which operator is used for exponentiation in Python?", options: ["^", "**", "^^", "exp()"], answer: 1 },
    { id: 6, type: "theory", q: "What does `len('hello')` return?", options: ["4", "5", "6", "Error"], answer: 1 },
    { id: 7, type: "theory", q: "Which of these is a mutable data type?", options: ["tuple", "string", "list", "int"], answer: 2 },
    { id: 8, type: "theory", q: "What will `bool(0)` return?", options: ["True", "False", "0", "None"], answer: 1 },
    { id: 9, type: "theory", q: "Which function is used to take input from the user?", options: ["get()", "input()", "read()", "scan()"], answer: 1 },
    { id: 10, type: "theory", q: "What is the correct way to comment a single line in Python?", options: ["// comment", "/* comment */", "# comment", "<!-- comment -->"], answer: 2 },
    { id: 11, type: "theory", q: "What will `print(type('5'))` output?", options: ["<class 'int'>", "<class 'str'>", "<class 'char'>", "<class 'float'>"], answer: 1 },
    { id: 12, type: "theory", q: "What does `int('42')` do?", options: ["Raises TypeError", "Returns 42 as integer", "Returns '42' as string", "Returns 42.0"], answer: 1 },
    { id: 13, type: "theory", q: "Which of the following will cause a ZeroDivisionError?", options: ["10 / 2", "10 % 3", "10 // 0", "10 ** 0"], answer: 2 },
    { id: 14, type: "theory", q: "What is the output of `print(2 ** 3 ** 2)`?", options: ["64", "512", "72", "8"], answer: 1 },
    { id: 15, type: "theory", q: "Which of these is a valid variable name in Python?", options: ["2name", "my-var", "_myVar", "class"], answer: 2 },
    { id: 16, type: "theory", q: "What will `print('5' + '3')` output?", options: ["8", "53", "Error", "'5'+'3'"], answer: 1 },
    { id: 17, type: "theory", q: "What does the `%` operator do in Python?", options: ["Division", "Percentage", "Modulus (remainder)", "Power"], answer: 2 },
    { id: 18, type: "theory", q: "Which loop is best when you don't know how many times to iterate?", options: ["for loop", "while loop", "do-while loop", "foreach loop"], answer: 1 },
    { id: 19, type: "theory", q: "What will `range(1, 5)` generate?", options: ["1,2,3,4,5", "1,2,3,4", "0,1,2,3,4", "1,2,3"], answer: 1 },
    { id: 20, type: "theory", q: "What is the output of this code?\n```\nx = 10\nif x > 5:\n  print('A')\nelse:\n  print('B')\n```", options: ["B", "A", "AB", "Error"], answer: 1 },
    { id: 21, type: "theory", q: "What is the purpose of `__init__` in a Python class?", options: ["To destroy an object", "To initialize object attributes", "To define class methods", "To inherit from parent"], answer: 1 },
    { id: 22, type: "theory", q: "What is `self` in a Python class method?", options: ["A global variable", "Reference to the current object instance", "A reserved keyword for strings", "Name of the class"], answer: 1 },
    { id: 23, type: "theory", q: "Which OOP concept allows a class to inherit from multiple parent classes?", options: ["Polymorphism", "Encapsulation", "Multiple Inheritance", "Abstraction"], answer: 2 },
    { id: 24, type: "theory", q: "What does `super()` do in Python?", options: ["Deletes the parent class", "Calls a method from the parent class", "Creates a new subclass", "Overrides all parent methods"], answer: 1 },
    { id: 25, type: "theory", q: "What is encapsulation in OOP?", options: ["Inheriting parent methods", "Hiding internal details and exposing only necessary parts", "Running multiple methods simultaneously", "Creating multiple objects from one class"], answer: 1 },
    { id: 26, type: "theory", q: "What will `print(10 != 10)` output?", options: ["True", "False", "0", "Error"], answer: 1 },
    { id: 27, type: "theory", q: "What is the output of `print(not True and False)`?", options: ["True", "False", "None", "Error"], answer: 1 },
    { id: 28, type: "theory", q: "Which format method correctly displays: `Hello Aryan`?\n```\nname = 'Aryan'\n```", options: ["print('Hello' + name)", "print(f'Hello {name}')", "print('Hello', {name})", "Both A and B"], answer: 3 },
    { id: 29, type: "theory", q: "What does `input()` always return?", options: ["int", "float", "str", "depends on what user types"], answer: 2 },
    { id: 30, type: "theory", q: "What is the output of:\n```\nx = 5\nx += 3\nprint(x)\n```", options: ["5", "3", "8", "53"], answer: 2 },
    { id: 31, type: "theory", q: "What is the output of `print(0.1 + 0.2 == 0.3)` in Python?", options: ["True", "False", "Error", "0.3"], answer: 1 },
    { id: 32, type: "theory", q: "What will `print(bool(''))` output?", options: ["True", "False", "None", "Error"], answer: 1 },
    { id: 33, type: "theory", q: "What is the output of `print(1_000_000)`?", options: ["Error", "1_000_000", "1000000", "1,000,000"], answer: 2 },
    { id: 34, type: "theory", q: "What does `pass` do in Python?", options: ["Stops execution", "Does nothing — placeholder", "Skips to next iteration", "Raises an exception"], answer: 1 },
    { id: 35, type: "theory", q: "What will this print?\n```\nfor i in range(3):\n  if i == 1:\n    continue\n  print(i)\n```", options: ["0 1 2", "0 2", "1 2", "0 1"], answer: 1 },
    { id: 36, type: "theory", q: "What is the output of `print(list(range(0, 10, 3)))`?", options: ["[0,3,6,9]", "[0,3,6]", "[3,6,9]", "[0,3,6,9,12]"], answer: 0 },
    { id: 37, type: "theory", q: "Which of these will NOT cause an error?\n```\nx = None\n```\nThen `print(x + 1)`", options: ["No error — prints 1", "TypeError", "NameError", "None1"], answer: 1 },
    { id: 38, type: "theory", q: "What is the result of `'abc' * 3`?", options: ["Error", "'abc abc abc'", "'abcabcabc'", "9"], answer: 2 },
    { id: 39, type: "theory", q: "What will `int(3.9)` return?", options: ["4", "3", "3.9", "Error"], answer: 1 },
    { id: 40, type: "theory", q: "What is the output of:\n```\nx = [1,2,3]\nx.append(4)\nprint(len(x))\n```", options: ["3", "4", "5", "Error"], answer: 1 },
    { id: 41, type: "project", q: "In your Simple Calculator project, which Python concept did you use to repeatedly ask the user for input until they choose to quit?", options: ["for loop", "while loop with a break condition", "recursion", "do-while loop"], answer: 1 },
    { id: 42, type: "project", q: "Your calculator needs to handle division by zero. Which Python tool is best for this?", options: ["if x != 0", "try-except block", "while x > 0", "assert statement"], answer: 1 },
    { id: 43, type: "project", q: "In the calculator project, what does `float(input())` do compared to just `input()`?", options: ["Both are the same", "Converts user input from string to decimal number", "Converts user input to integer", "Raises an error"], answer: 1 },
    { id: 44, type: "project", q: "To add operations like +,-,*,/ in your calculator, which structure is most Pythonic?", options: ["Nested if-elif-else", "Dictionary mapping operators to functions", "Multiple functions with same name", "Switch statement"], answer: 1 },
    { id: 45, type: "project", q: "Your To-Do List app needs to mark a task as complete. If tasks is a list of dicts, what is the correct way?", options: ["tasks[index] = done", "tasks[index]['done'] = True", "tasks.complete(index)", "done(tasks[index])"], answer: 1 },
    { id: 46, type: "project", q: "In a To-Do app, which data structure best stores multiple tasks with properties (title, done, priority)?", options: ["List of strings", "List of dictionaries", "Single string", "Tuple of integers"], answer: 1 },
    { id: 47, type: "project", q: "To delete a task at position 2 from a list in Python:", options: ["tasks.remove(2)", "del tasks[2]", "tasks.delete(2)", "tasks.pop(index=2)"], answer: 1 },
    { id: 48, type: "project", q: "Your calculator shows wrong result: `'5' + '3' = '53'`. What is the fix?", options: ["Use `str()` on both", "Use `int()` or `float()` to convert inputs before adding", "Use `print()` differently", "This is correct behavior"], answer: 1 },
    { id: 49, type: "project", q: "In your calculator, the user enters `'abc'` instead of a number. What happens with `float('abc')`?", options: ["Returns 0.0", "Returns None", "Raises ValueError", "Returns 'abc'"], answer: 2 },
    { id: 50, type: "project", q: "What is the best way to display `Result: 8.0` when the user calculates `4 * 2`?", options: ["print('Result: ' + result)", "print(f'Result: {result}')", "print('Result:', result)", "Both B and C are correct"], answer: 3 },
  ],
};

module.exports = { CERTIFICATE_QUESTIONS };
