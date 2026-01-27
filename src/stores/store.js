import { defineStore, acceptHMRUpdate } from 'pinia'

// Mock Data
const MOCK_LESSONS = [
  {
    id: '1',
    title: 'Variables & Mutability',
    description: 'Learn how to declare and modify variables in Rust.',
    isCompleted: true,
    isLocked: false,
    content: `
# Rust Basics: Variables

In Rust, variables are **immutable** by default. This is one of the many nudges Rust gives you to write code that takes advantage of the safety and easy concurrency that Rust offers.

### The Task
1. Declare a mutable variable named \`counter\`.
2. Set it to \`0\`.
3. Increment it by \`1\`.
4. Print the result.

\`\`\`rust
fn main() {
    // Your code here
}
\`\`\`

### Hints
- Use the \`mut\` keyword to make a variable mutable.
- Remember to use semi-colons \`;\` at the end of statements.
    `,
    files: [
      {
        name: 'src/main.rs',
        language: 'rust',
        code: `fn main() {
    // Write your code here
    let mut counter = 0;
    counter += 1;
    println!("Counter is: {}", counter);
}`,
      },
    ],
  },
  {
    id: '2',
    title: 'Data Types',
    description: 'Understand scalar and compound types.',
    isCompleted: false,
    isLocked: false, // current
    content: `
# Data Types

Rust is a strictly typed language. Let's explore integers, floats, and booleans.

### The Task
1. Create a variable \`x\` of type \`i32\`.
2. Create a variable \`y\` of type \`f64\`.
3. Print them.
    `,
    files: [
      {
        name: 'src/main.rs',
        language: 'rust',
        code: `fn main() {
    // Create variables here
    let x: i32 = 5;
    let y: f64 = 3.14;
    println!("x: {}, y: {}", x, y);
}
`,
      },
      {
        name: 'src/types.rs',
        language: 'rust',
        code: `// This is a helper file for types
// You can define structs or enums here
pub struct Point {
    x: i32,
    y: i32,
}
`,
      },
    ],
  },
  {
    id: '3',
    title: 'Functions',
    description: 'How to define and call functions.',
    isCompleted: false,
    isLocked: true,
    files: [
      {
        name: 'src/main.rs',
        language: 'rust',
        code: `fn main() {
    greet();
}

fn greet() {
    println!("Hello from a function!");
}`,
      },
    ],
  },
  {
    id: '4',
    title: 'Control Flow',
    description: 'If statements and loops.',
    isCompleted: false,
    isLocked: true,
    files: [
      {
        name: 'src/main.rs',
        language: 'rust',
        code: `fn main() {
    let number = 3;
    if number < 5 {
        println!("condition was true");
    } else {
        println!("condition was false");
    }
}`,
      },
    ],
  },
  {
    id: '5',
    title: 'Ownership',
    description: 'Deep dive into Rust unique ownership model.',
    isCompleted: false,
    isLocked: true,
    files: [
      {
        name: 'src/main.rs',
        language: 'rust',
        code: `fn main() {
    let s1 = String::from("hello");
    let s2 = s1;
    // println!("{}, world!", s1); // This would error!
    println!("{}, world!", s2);
}`,
      },
    ],
  },
]

export const useLessonStore = defineStore('lesson', {
  state: () => ({
    lessons: MOCK_LESSONS,
    currentLessonId: '2',
    isSidebarOpen: false,
  }),

  getters: {
    currentLessonIndex: (state) => state.lessons.findIndex((l) => l.id === state.currentLessonId),
    currentLesson: (state) =>
      state.lessons.find((l) => l.id === state.currentLessonId) || state.lessons[0],
    totalSteps: (state) => state.lessons.length,
    currentStep: (state) => {
      const index = state.lessons.findIndex((l) => l.id === state.currentLessonId)
      return index + 1
    },
    isFirstLesson: (state) => {
      const index = state.lessons.findIndex((l) => l.id === state.currentLessonId)
      return index === 0
    },
    isLastLesson: (state) => {
      const index = state.lessons.findIndex((l) => l.id === state.currentLessonId)
      return index === state.lessons.length - 1
    },
  },

  actions: {
    nextLesson() {
      const currentIndex = this.currentLessonIndex
      if (currentIndex < this.lessons.length - 1) {
        // Mark current as completed
        this.lessons[currentIndex].isCompleted = true

        const nextIndex = currentIndex + 1
        this.lessons[nextIndex].isLocked = false
        this.currentLessonId = this.lessons[nextIndex].id
      }
    },

    prevLesson() {
      const currentIndex = this.currentLessonIndex
      if (currentIndex > 0) {
        this.currentLessonId = this.lessons[currentIndex - 1].id
      }
    },

    setCurrentLesson(id) {
      const lesson = this.lessons.find((l) => l.id === id)
      if (lesson && !lesson.isLocked) {
        this.currentLessonId = id
      }
    },

    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen
    },

    setSidebarOpen(isOpen) {
      this.isSidebarOpen = isOpen
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLessonStore, import.meta.hot))
}
