// Simple math-based CAPTCHA generator

export function generateCaptcha() {
  const operations = [
    { 
      generate: () => {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        return {
          question: `What is ${a} + ${b}?`,
          answer: String(a + b)
        };
      }
    },
    {
      generate: () => {
        const a = Math.floor(Math.random() * 20) + 10;
        const b = Math.floor(Math.random() * 10) + 1;
        return {
          question: `What is ${a} - ${b}?`,
          answer: String(a - b)
        };
      }
    },
    {
      generate: () => {
        const a = Math.floor(Math.random() * 5) + 1;
        const b = Math.floor(Math.random() * 5) + 1;
        return {
          question: `What is ${a} × ${b}?`,
          answer: String(a * b)
        };
      }
    },
    {
      generate: () => {
        const words = ['TRADE', 'COIN', 'BULL', 'BEAR', 'HODL', 'MOON'];
        const word = words[Math.floor(Math.random() * words.length)];
        return {
          question: `Type the word: ${word}`,
          answer: word
        };
      }
    }
  ];

  const operation = operations[Math.floor(Math.random() * operations.length)];
  const captcha = operation.generate();
  
  // Generate wrong options
  const options = [captcha.answer];
  while (options.length < 3) {
    let wrong;
    if (isNaN(captcha.answer)) {
      // For word CAPTCHAs
      const words = ['TRADE', 'COIN', 'BULL', 'BEAR', 'HODL', 'MOON'];
      wrong = words[Math.floor(Math.random() * words.length)];
    } else {
      // For math CAPTCHAs
      const correctNum = parseInt(captcha.answer);
      const offset = Math.floor(Math.random() * 10) + 1;
      wrong = String(Math.random() > 0.5 ? correctNum + offset : correctNum - offset);
    }
    
    if (!options.includes(wrong) && wrong !== captcha.answer) {
      options.push(wrong);
    }
  }
  
  // Shuffle options
  options.sort(() => Math.random() - 0.5);
  
  return {
    question: captcha.question,
    answer: captcha.answer,
    options
  };
}

export function generateTradingQuiz() {
  const questions = [
    {
      question: "What does 'HODL' mean in crypto?",
      options: ["Hold", "Hurry Order Deliver Late", "High Order Data Link"],
      answer: "Hold"
    },
    {
      question: "What is a 'pump and dump'?",
      options: [
        "A price manipulation scheme",
        "A trading strategy",
        "A type of cryptocurrency"
      ],
      answer: "A price manipulation scheme"
    },
    {
      question: "What should you never share?",
      options: [
        "Your private keys",
        "Market analysis",
        "Trading tips"
      ],
      answer: "Your private keys"
    },
    {
      question: "What is 'DYOR'?",
      options: [
        "Do Your Own Research",
        "Daily Yield On Returns",
        "Don't Yell Or Run"
      ],
      answer: "Do Your Own Research"
    }
  ];
  
  const quiz = questions[Math.floor(Math.random() * questions.length)];
  
  // Shuffle options
  const shuffled = [...quiz.options].sort(() => Math.random() - 0.5);
  
  return {
    question: quiz.question,
    answer: quiz.answer,
    options: shuffled
  };
}