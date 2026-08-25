export interface Part1Topic {
  id: string;
  title: string;
  questions: string[];
}

export interface Part2Topic {
  id: string;
  title: string;
  cue: string;
  bullets: string[];
}

export interface Part3Topic {
  id: string;
  title: string;
  questions: string[];
}

export const PART1: Part1Topic[] = [
  {
    id: 'accommodation',
    title: 'Accommodation',
    questions: [
      'Tell me about the kind of accommodation you live in.',
      'Do you live in a house or a flat?',
      'Is it a big place?',
      'Does the place you live in have many amenities?',
      'What do you like about living there?',
      'Is there anything you would like to change about the place you live in?',
      'How long have you lived there?',
      'Do you plan to live there for a long time?',
      'Is there a garden in the place you live in?',
    ],
  },
  {
    id: 'advertisements',
    title: 'Advertisements',
    questions: [
      'Do you like watching advertisements?',
      'Will you buy something because of an advertisement?',
      'How do you feel when you see pop-up ads on the internet?',
      'Do you like funny or serious advertisements?',
      'What makes a good advertisement?',
    ],
  },
  {
    id: 'art_photography',
    title: 'Art & Photography',
    questions: [
      'Do you like art?',
      'Do you think art classes are necessary?',
      "How do you think art classes affect children's development?",
      'What benefits can you get from painting as a hobby?',
      'Do you like to take photographs?',
      'Do you prefer to take photos yourself or to have other people take photos?',
      'How often do you take photographs?',
      'Do you prefer to take pictures of people or of scenery?',
      'Do you prefer to take photos with a phone or with a camera?',
      'Do you take many photographs when you travel?',
      'Do you like looking at photographs of yourself?',
      'Have you put any photographs you have taken on the walls in your house?',
    ],
  },
  {
    id: 'animals',
    title: 'Animals',
    questions: [
      'Do you like animals?',
      'What is your favourite animal?',
      'What types of animals do you have in your country?',
      'What types of animals are kept as pets in your country?',
      'Do you think animals should be kept in zoos?',
      'Do you have any animals in your home as a pet?',
      'Did you have a pet when you were a child?',
      'Would you like to have a pet in the future?',
      'What types of animals do you think make the best pets?',
      'Why do people have pets?',
      'Should dogs be left in the house alone while their owners are at work?',
      'Is there any type of animal that you think should not be kept as a pet?',
    ],
  },
  {
    id: 'hometown',
    title: 'Hometown',
    questions: [
      'Where is your hometown?',
      'What do you like about it?',
      'What do you not like about it?',
      'Is there any way your hometown could be made better?',
      'How important is your hometown to you?',
      'How has your hometown changed over the years?',
      'Do you think you will continue to live in your hometown?',
      'How often do you visit your hometown?',
      'How many people live in your hometown?',
      'What kind of jobs do the people in your hometown do?',
      'What is your hometown famous for?',
      "What's the oldest part of your hometown?",
    ],
  },
  {
    id: 'work',
    title: 'Work',
    questions: [
      'Do you have a job right now?',
      'Do you enjoy your job?',
      'What responsibilities do you have at work?',
      'What is your typical day like at work?',
      'What would you change about your job?',
      'What job do you think you will be doing in five years?',
      'What skills and qualifications are required for this job?',
      'Do you get on well with your co-workers?',
      'Are there good work opportunities in your home country?',
    ],
  },
  {
    id: 'studies',
    title: 'Studies',
    questions: [
      'Do you work or study?',
      'What is your major?',
      'Why did you choose this subject?',
      'Do you find your studies interesting?',
      'What are your future plans after graduation?',
    ],
  },
];

export const PART2: Part2Topic[] = [
  {
    id: 'p2-advertisement',
    title: 'An advertisement that persuaded you',
    cue: 'Describe an advertisement that persuaded you to buy a product.',
    bullets: [
      'What advertisement it was',
      'Was it shown on TV, radio or newspaper',
      'What was good about that advertisement',
      'Explain why it made the product seem attractive.',
    ],
  },
  {
    id: 'p2-challenging',
    title: 'A challenging thing you did',
    cue: 'Describe a challenging thing you have done.',
    bullets: [
      'When you did it',
      'Why you did it',
      'How you handled this challenge',
      'Explain why you thought it was challenging.',
    ],
  },
  {
    id: 'p2-old-person',
    title: 'An old person you know',
    cue: 'Describe an old person that you know.',
    bullets: [
      'What your relationship is with this person',
      'How often you see them',
      'What people think about this person',
      'Explain why you like them.',
    ],
  },
];

export const PART3: Part3Topic[] = [
  {
    id: 'p3-advertising',
    title: 'Advertising & Consumerism',
    questions: [
      'What are the different types of advertising?',
      'Do you think advertising influences what people buy?',
      'Should advertising aimed at children be banned?',
      'How has advertising changed over the last few decades?',
    ],
  },
  {
    id: 'p3-education',
    title: 'Education & Learning',
    questions: [
      'How has education changed in your country in recent years?',
      'What role will technology play in education in the future?',
      'Is university education necessary for a successful career?',
    ],
  },
];

export const SPEAKING_TOPICS = {
  part1: PART1,
  part2: PART2,
  part3: PART3,
};

export function topicsForPart(part: number): any[] {
  if (part === 1) return PART1;
  if (part === 2) return PART2;
  return PART3;
}

export function findTopic(part: number, topicId: string): any {
  const list = topicsForPart(part);
  return list.find((t: any) => t.id === topicId) || list[0];
}

export function getQuestionItem(part: number, topicId: string, index = 0) {
  if (part === 1) {
    const topic = PART1.find((t) => t.id === topicId) || PART1[0];
    const safeIndex = index % (topic.questions.length || 1);
    return {
      part: 1,
      topicId: topic.id,
      topicTitle: topic.title,
      index: safeIndex,
      text: topic.questions[safeIndex] || '',
      totalInTopic: topic.questions.length,
    };
  } else if (part === 2) {
    const topic = PART2.find((t) => t.id === topicId) || PART2[0];
    return {
      part: 2,
      topicId: topic.id,
      topicTitle: topic.title,
      cue: topic.cue,
      bullets: topic.bullets,
    };
  } else {
    const topic = PART3.find((t) => t.id === topicId) || PART3[0];
    const safeIndex = index % (topic.questions.length || 1);
    return {
      part: 3,
      topicId: topic.id,
      topicTitle: topic.title,
      index: safeIndex,
      text: topic.questions[safeIndex] || '',
      totalInTopic: topic.questions.length,
    };
  }
}
