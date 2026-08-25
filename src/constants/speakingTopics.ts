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
    id: 'bags_boats',
    title: 'Bags & Boats',
    questions: [
      'Have you ever taken a ride on a boat?',
      'Do you like travelling by boat?',
      'What are the advantages of travelling by boat?',
      'Do people in your country like to travel by boat?',
      'Will it get more popular in the future?',
      'Do you like bags?',
      'What types of bags do you like?',
      'Do you usually carry a bag when you go out?',
      'What types of bags do you use in your everyday life?',
      'What do you put in these bags?',
      'What sorts of bags do women like to buy?',
    ],
  },
  {
    id: 'birthdays',
    title: 'Birthdays',
    questions: [
      'What did you usually do on your birthday when you were a child?',
      'How do you normally celebrate your birthday now?',
      'Is your birthday now still as important to you as when you were a child?',
      'Do you think it’s important to give someone a card when it’s their birthday?',
      'Do you think the price of gifts or presents is important?',
    ],
  },
  {
    id: 'books',
    title: 'Books & Reading',
    questions: [
      'Do you like reading books? Why?',
      'How often do you read?',
      'Do you have many books at home?',
      'Do you prefer to buy books or borrow them?',
      'What are the benefits of reading?',
      'What book would you take on a long journey?',
      'How easy is it for you to read books in English?',
      'Have you given up reading a book recently?',
      'What kinds of books do you like to read?',
      'What is the best book you’ve ever read?',
      'Is reading books a popular activity in your country?',
      'Do you think electronic books or eReaders are better than real books?',
    ],
  },
  {
    id: 'celebrity',
    title: 'Celebrities',
    questions: [
      'Who is your favourite celebrity?',
      'Do you like any foreign celebrities?',
      'Would you want to be a celebrity in the future?',
      'Do you think we should protect famous people’s privacy?',
      'How do celebrities influence their fans in your country?',
    ],
  },
  {
    id: 'clothes_fashion',
    title: 'Clothes & Fashion',
    questions: [
      'What is your favourite item of clothing?',
      'Are there any traditional clothes in your country?',
      'Where do you usually purchase your clothes?',
      'Have you ever bought clothes online?',
      'Were you interested in fashion when you were a child?',
      'Is fashion important to you now?',
      'What types of clothes are fashionable for young people in your country these days?',
      'Does fashion change for people as they get older?',
    ],
  },
  {
    id: 'colours',
    title: 'Colours',
    questions: [
      'What colours do you like?',
      'What’s the most popular colour in your country?',
      'Do you like to wear dark or bright colours?',
      'What’s the difference between men and women’s preference for colours?',
      'Do colours affect your mood?',
    ],
  },
  {
    id: 'computers',
    title: 'Computers & Technology',
    questions: [
      'Do you use computers?',
      'What do you use a computer to do?',
      'Did you use computers when you were little?',
      'Do people often use computers these days?',
      'Will people continue to use computers in the future?',
    ],
  },
  {
    id: 'country',
    title: 'Your Country',
    questions: [
      'What is your country famous for?',
      'Where do you live in your country?',
      'Is it an interesting place to live?',
      'Are you planning to live there in the future?',
    ],
  },
  {
    id: 'daily_routine',
    title: 'Daily Routine',
    questions: [
      'Tell me about your daily routine.',
      'Has your daily routine changed since you were a child?',
      'Is your daily routine different at the weekend compared to during the week?',
      'What would you like to change about your daily routine?',
      'Do you think it’s important to have a daily routine?',
    ],
  },
  {
    id: 'dictionaries',
    title: 'Dictionaries',
    questions: [
      'Do you ever use a dictionary?',
      'Do you prefer paper or electronic dictionaries?',
      'Are dictionaries used a lot in schools in your country?',
      'Do you think dictionaries are useful for learning a language?',
    ],
  },
  {
    id: 'dreams',
    title: 'Dreams',
    questions: [
      'Do you dream much at night?',
      'Do you often remember your dreams?',
      'Do you think we can learn anything from dreams?',
      'Do people in your country talk about their dreams?',
      'Do you think that dreams can come true?',
    ],
  },
  {
    id: 'email',
    title: 'Email & Letters',
    questions: [
      'What kinds of emails do you receive about your work or studies?',
      'Do you prefer to email, phone, or text your friends?',
      'Do you reply to emails as soon as you receive them?',
      'Are you happy to receive emails that are advertising things?',
      'Do you email people often?',
      'Do you chat with friends or family more with email?',
      'Do you think people prefer to receive an email or a letter?',
      'Do you think it’s easier to write an email or a letter?',
      'Do you think email will eventually replace letter writing?',
    ],
  },
  {
    id: 'exercise',
    title: 'Exercise & Fitness',
    questions: [
      'Do you do much exercise?',
      'Do you do more exercise now than when you were a child?',
      'Do people in your country do a lot of exercise?',
      'What do you think is the best exercise to keep fit?',
      'Have the types of exercise people like to do changed since you were a child?',
    ],
  },
  {
    id: 'family_housework',
    title: 'Family & Housework',
    questions: [
      'How many people are there in your immediate family?',
      'Who do you get on best with in your family?',
      'Do you have a large extended family?',
      'What do you do together with your family?',
      'Why is family important to you?',
      'Do you do housework at home?',
      'What kind of housework do you often do?',
      'Did you do housework when you were a child?',
      'Do you think that children should do housework?',
      'How much time do you manage to spend with members of your family?',
    ],
  },
  {
    id: 'flowers',
    title: 'Flowers',
    questions: [
      'Have you ever given anybody flowers?',
      'Is it popular to give flowers to people in your country?',
      'On what special occasions do people give flowers in your country?',
      'What kinds of flowers would you like to receive as a present?',
    ],
  },
  {
    id: 'friends',
    title: 'Friends',
    questions: [
      'Do you have a lot of friends?',
      'Who is your best friend and why?',
      'Who would you most like to be friends with and why?',
      'What kind of person can you make friends with easily?',
      'Which is more important to you, friends or family?',
    ],
  },
  {
    id: 'food',
    title: 'Food & Cooking',
    questions: [
      'Do you enjoy cooking?',
      'What type of things can you cook?',
      'What kinds of food are popular in your country?',
      'Is it an important part of your culture to have dinner parties?',
      'Do you prefer to eat with other people or on your own?',
      'Do you have a healthy diet?',
      'Do you prefer eating at home or eating out?',
      'Do you like ordering food to be delivered?',
      'Do you eat meals differently now compared to when you were little?',
    ],
  },
  {
    id: 'gifts_noise',
    title: 'Gifts & Noise',
    questions: [
      'Do you mind noises?',
      'What types of noise do you come across in your daily life?',
      'Are there any sounds that you like?',
      'Where can you hear loud noises?',
      'Do you think there’s too much noise in modern society?',
      'When do you send gifts?',
      'When was the last time you received a gift?',
      'Have you received a gift you didn’t like?',
      'How do you feel when you receive a gift?',
    ],
  },
  {
    id: 'high_school',
    title: 'High School',
    questions: [
      'Who was your favourite teacher in high school?',
      'What was your favourite subject in high school?',
      'Do you still remember what happened on your first day of high school?',
      'Do you still keep in touch with your friends from high school?',
      'Do you miss your life in high school?',
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
      'What kind of jobs do the people in your hometown do?',
      'What is your hometown famous for?',
      "What's the oldest part of your hometown?",
    ],
  },
  {
    id: 'humour',
    title: 'Humour & Laughter',
    questions: [
      'What type of programmes do you find funny on TV?',
      'Which types of programmes are most popular in your country?',
      'What kind of things make you laugh?',
      'Do you like to make people laugh?',
    ],
  },
  {
    id: 'indoor_activities',
    title: 'Indoor Activities & Transport',
    questions: [
      'Do you prefer public transportation or private transportation?',
      'What are the most popular means of transportation in your hometown?',
      'Is it easy to catch a bus in your country?',
      'Is driving to work popular in your country?',
      'Do you like indoor activities?',
      'What indoor activities do you like?',
      'How much time do you spend indoors every week?',
    ],
  },
  {
    id: 'internet',
    title: 'The Internet',
    questions: [
      'How important is the Internet to you?',
      'Do you use the Internet more for work or in your free time?',
      'What are your favourite websites?',
      'Do you think you use the Internet too much?',
      'How will the Internet develop in the future?',
      'What are the positive and negative things about the Internet?',
    ],
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle & Free Time',
    questions: [
      'What do you do in your free time?',
      'Do you have a busy social life?',
      'Do you lead an active life?',
      'Has your life changed much in the last year?',
      'What would you like to change about your lifestyle?',
      'What type of activities do you like to do in your free time?',
      'Do you like to do these activities alone or with other people?',
      'Do you think people have enough free time?',
    ],
  },
  {
    id: 'major_studies',
    title: 'Major & Studies',
    questions: [
      'Do you work or study?',
      'What is your major?',
      'Did you or do you like it?',
      'Is it a popular major at your university?',
      'Why did you choose that major?',
      'What is the most difficult part of studying that subject?',
      'Do you plan to use the subject you are studying in the future?',
    ],
  },
  {
    id: 'mobile_phones',
    title: 'Mobile Phones',
    questions: [
      'Do you have a mobile phone?',
      'At what age did you first get a mobile?',
      'What do you most use it for?',
      'Is it a nuisance if people use mobiles in public places such as trains and buses?',
    ],
  },
  {
    id: 'movies',
    title: 'Movies & Cinema',
    questions: [
      'How often do you go to the cinema?',
      'Are cinema tickets expensive in your country?',
      'What are the advantages of seeing a film at the cinema?',
      'Do you usually watch films alone or with others?',
      'Which actor would you like to play you in a film?',
    ],
  },
  {
    id: 'museums',
    title: 'Museums',
    questions: [
      'Are museums popular in your country?',
      'Did you visit museums when you were a child?',
      'Do you like to visit museums nowadays?',
      'Do you think you should pay to visit museums?',
    ],
  },
  {
    id: 'music',
    title: 'Music & Instruments',
    questions: [
      'How do you listen to music?',
      'When do you listen to music?',
      'What’s your favourite kind of music?',
      'Is music an important subject at school in your country?',
      'What kinds of music are popular in your country?',
      'Do you like to listen to live music?',
      'Have you ever been to a concert before?',
      'How much time do you spend listening to music every day?',
      'Have you ever learned to play a musical instrument?',
      'What do you think is the best age to start learning to play a musical instrument?',
    ],
  },
  {
    id: 'neighbours',
    title: 'Neighbours',
    questions: [
      'Do you know the people who live next door to you?',
      'How often do you see each other?',
      'What kind of relationship do you have?',
      'How can neighbours be helpful?',
      'What kind of problems can people have with their neighbours in a big city?',
    ],
  },
  {
    id: 'newspapers_magazines',
    title: 'Newspapers & Magazines',
    questions: [
      'Which do you prefer reading, newspapers or magazines?',
      'What type of stories do you like to read about?',
      'Do you think reading a magazine or a newspaper can help you learn a language?',
      'Why do you think some people prefer magazines to newspapers?',
      'Do you often read newspapers?',
      'Do you prefer to read local news or international news?',
      'Which is more popular where you live, newspapers or magazines?',
    ],
  },
  {
    id: 'outdoor_activities',
    title: 'Outdoor Activities',
    questions: [
      'Do you like outdoor activities?',
      'What outdoor sports do you like?',
      'How much time do you spend outdoors every week?',
      'What types of outdoor activities are popular in your country?',
    ],
  },
  {
    id: 'patience_politeness',
    title: 'Patience & Politeness',
    questions: [
      'What do you think patience is?',
      'Do you think patience is important?',
      'Do you think you are a patient person?',
      'Have you ever lost your patience?',
      'Are you a polite person?',
      'Who taught you to be polite?',
      'Is it important to be polite?',
    ],
  },
  {
    id: 'public_transport',
    title: 'Public Transport',
    questions: [
      'What kinds of public transport do you have in your country?',
      'What kinds of public transport do most people use?',
      'What is your favourite type of public transport?',
      'What do you do when you are travelling on public transport?',
      'How could public transport in your country be improved?',
    ],
  },
  {
    id: 'seasons',
    title: 'Seasons & Weather',
    questions: [
      'What is your favourite season?',
      'Tell me about the different seasons in your country.',
      'How do the clothes people wear change with the seasons?',
      'Is tourism popular in a particular season in your country?',
      'What season do you think is most suitable for work or study?',
    ],
  },
  {
    id: 'sports',
    title: 'Sports',
    questions: [
      'Do you play any sports?',
      'Do you watch sports on TV?',
      'What is the most popular sport in your country?',
      'How do people in your country stay fit?',
      'Is it important for children to play sports?',
      'What sports do children normally do at school?',
    ],
  },
  {
    id: 'sea',
    title: 'The Sea & Holidays',
    questions: [
      'Do you like to go on holiday by sea?',
      'Are there many hotels by the sea in your country?',
      'What kind of activities can people do by the sea?',
      'How long do people normally visit the sea when they go on holiday?',
    ],
  },
  {
    id: 'timing',
    title: 'Timing & Punctuality',
    questions: [
      'Is being late acceptable in your culture?',
      'Are you ever late for appointments?',
      'What type of excuses do you think are alright for lateness?',
      'How do you feel when someone is late for an appointment with you?',
    ],
  },
  {
    id: 'travel',
    title: 'Travel & Tourism',
    questions: [
      'Where was the last place you visited on holiday?',
      'Would you like to go back there again?',
      'What kind of tourist destinations do you usually prefer?',
      'Has a foreign visitor ever stayed at your home?',
      'What’s the best way to save money while travelling?',
    ],
  },
  {
    id: 'trees',
    title: 'Trees & Nature',
    questions: [
      'Do you like trees?',
      'Are there many trees in your hometown?',
      'Do you think there are enough trees in most cities?',
      'What are the benefits of planting more trees?',
    ],
  },
  {
    id: 'tv',
    title: 'Television',
    questions: [
      'Do you like watching TV?',
      'How often do you watch TV?',
      'What kind of TV programmes do you like to watch?',
      'What is your favourite TV show now?',
      'What was your favourite show when you were a child?',
      'Do you think children in your country watch too much television?',
    ],
  },
  {
    id: 'volunteer_work',
    title: 'Volunteer Work',
    questions: [
      'Have you ever worked before?',
      'What was your first day at work like?',
      'Have you participated in any volunteer work?',
      'Why did you do the volunteer work?',
      'How do you define volunteer work?',
    ],
  },
  {
    id: 'weather',
    title: 'Weather & Climate',
    questions: [
      'How is the weather today?',
      'What’s your favourite kind of weather?',
      'Is there any type of weather you really don’t like?',
      'What is the climate like in your country?',
      'Does the weather affect people’s lives in your country?',
      'Do you pay attention to weather forecasts?',
      'Has the weather changed much in your country in recent years?',
    ],
  },
  {
    id: 'work',
    title: 'Work & Career',
    questions: [
      'Do you have a job right now?',
      'Do you enjoy your job?',
      'What responsibilities do you have at work?',
      'What is your typical day like at work?',
      'What would you change about your job?',
      'What job do you think you will be doing in five years?',
      'Do you get on well with your co-workers?',
    ],
  },
  {
    id: 'writing',
    title: 'Writing & Letters',
    questions: [
      'Do you enjoy writing?',
      'What age do children normally learn to write in your country?',
      'Did you write a lot when you were a child?',
      'Do you ever write letters?',
      'Do you prefer writing letters or sending emails?',
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
  {
    id: 'p2-child-know',
    title: 'A child you know',
    cue: 'Describe a child that you know and like a lot.',
    bullets: [
      'Who the child is',
      'How you know them',
      'What they enjoy doing',
      'Explain why you like them a lot.',
    ],
  },
  {
    id: 'p2-influential-person',
    title: 'Someone who influenced you',
    cue: 'Describe someone who has had an important influence on your life.',
    bullets: [
      'Who the person is',
      'How long you have known him/her',
      'What qualities this person has',
      'Explain why they have had such an influence on you.',
    ],
  },
  {
    id: 'p2-interesting-person',
    title: 'An interesting person',
    cue: 'Describe a person that you think is very interesting.',
    bullets: [
      'Who this person is',
      'How you met them',
      'What they like to talk about',
      'Explain why this person is very interesting.',
    ],
  },
  {
    id: 'p2-intelligent-person',
    title: 'An intelligent person',
    cue: 'Describe an intelligent person you know.',
    bullets: [
      'Who this person is',
      'When and where you first met them',
      'What this person does in life',
      'Explain why you think this person is intelligent.',
    ],
  },
  {
    id: 'p2-favourite-teacher',
    title: 'Your favourite teacher',
    cue: 'Describe your favourite teacher from school.',
    bullets: [
      'What school he/she taught at',
      'What he/she looked like',
      'What subject he/she taught you',
      'Explain why you remember this teacher so well.',
    ],
  },
  {
    id: 'p2-childhood-friend',
    title: 'A childhood friend',
    cue: 'Describe your favourite childhood friend.',
    bullets: [
      'Who he/she is',
      'Where you met each other',
      'What you often did together',
      'Explain what made you like him/her.',
    ],
  },
  {
    id: 'p2-grows-plants',
    title: 'Someone who grows plants',
    cue: 'Describe a person you know who loves to grow plants (vegetables, fruits, flowers).',
    bullets: [
      'Who this person is',
      'What they grow',
      'Where they grow them',
      'Explain why they enjoy growing plants.',
    ],
  },
  {
    id: 'p2-gift-given',
    title: 'A gift you gave',
    cue: 'Describe a present or gift you have given someone.',
    bullets: [
      'Who you gave it to',
      'What kind of present it was',
      'How it compared to other presents',
      'Explain why you decided to give this gift.',
    ],
  },
  {
    id: 'p2-gift-received',
    title: 'A gift you received',
    cue: 'Describe a present or gift someone gave you that you really liked.',
    bullets: [
      'What kind of present it was',
      'Who gave it to you',
      'Why you were given it',
      'Explain why you liked it.',
    ],
  },
  {
    id: 'p2-person-taught-you',
    title: 'Someone who taught you something',
    cue: 'Describe a person who taught you something important.',
    bullets: [
      'Who this person was',
      'What they taught you',
      'How they taught it to you',
      'Explain why you think what they taught is important.',
    ],
  },
  {
    id: 'p2-animal',
    title: 'An interesting animal',
    cue: 'Describe an interesting animal you have seen.',
    bullets: [
      'What animal it was',
      'When and where you saw it',
      'How you feel about this animal',
      'Explain why you think this animal is interesting.',
    ],
  },
  {
    id: 'p2-painting',
    title: 'A painting you like',
    cue: 'Talk about a painting you would like to have in your home.',
    bullets: [
      'What it is',
      'How you know about it',
      'How much it would cost you',
      'Explain why you want to have it in your home.',
    ],
  },
  {
    id: 'p2-apology',
    title: 'A time someone apologised',
    cue: 'Describe a time when someone apologised to you.',
    bullets: [
      'When this happened',
      'What you were doing',
      'Who apologised to you',
      'Explain why they apologised to you.',
    ],
  },
  {
    id: 'p2-book',
    title: 'A book you read',
    cue: 'Talk about a book you are reading now or have read recently.',
    bullets: [
      'How and why you got it',
      'How long it took you to read it',
      'What kind of book it is',
      'Explain if you would like to read something similar or not and why.',
    ],
  },
  {
    id: 'p2-building',
    title: 'A building you like',
    cue: 'Describe a building that you particularly like.',
    bullets: [
      'Where the building is',
      'What it looks like',
      'What you can do there',
      'Explain why you like this building.',
    ],
  },
  {
    id: 'p2-small-business',
    title: 'A small business',
    cue: 'Describe a small business you want to start or know about.',
    bullets: [
      'What business it would be',
      'When you want to start it',
      'Why you have not started it yet',
      'Explain why you want to start this business.',
    ],
  },
  {
    id: 'p2-positive-change',
    title: 'A positive change in life',
    cue: 'Describe a positive change in your life.',
    bullets: [
      'What the change was about',
      'When it happened',
      'Details of the change',
      'Describe how it affected you later in life.',
    ],
  },
  {
    id: 'p2-favourite-clothing',
    title: 'Favourite clothing',
    cue: 'Describe your favourite piece of clothing.',
    bullets: [
      'Where you got it',
      'Do you often wear it',
      'When you wear it',
      'Explain why it is your favourite piece of clothing.',
    ],
  },
  {
    id: 'p2-uniform',
    title: 'A uniform you wore',
    cue: 'Describe a uniform you have worn (such as a school or company uniform).',
    bullets: [
      'What it looked like',
      'When and where you needed to wear this uniform',
      'Who paid for this uniform',
      'Explain how you felt about that uniform.',
    ],
  },
  {
    id: 'p2-favourite-city',
    title: 'A favourite city',
    cue: 'Describe your favourite city or a city you have visited that you like very much.',
    bullets: [
      'Its name and where it is',
      'When you visited it',
      'Why you liked it',
      'Major attractions in this city.',
    ],
  },
  {
    id: 'p2-company',
    title: 'A company or organisation',
    cue: 'Describe an organisation or a company that you know.',
    bullets: [
      'How big it is',
      'Do you find this company to be successful and why',
      'What the working environment is like',
      'Explain if you would like to work there.',
    ],
  },
  {
    id: 'p2-favourite-time',
    title: 'Favourite part of the day',
    cue: 'Describe your favourite part of the day.',
    bullets: [
      'What time of day this is',
      'What you like to do at this time',
      'Who you are usually with',
      'Explain why this is your favourite part of the day.',
    ],
  },
  {
    id: 'p2-important-decision',
    title: 'An important decision',
    cue: 'Describe an important decision you have made.',
    bullets: [
      'What the decision was',
      'Why you made that choice',
      'Who helped you make the choice',
      'Explain why the decision was so important.',
    ],
  },
  {
    id: 'p2-electronic-device',
    title: 'An electronic device',
    cue: 'Describe a useful electronic device you would like to own or have.',
    bullets: [
      'What it is',
      'How it would help your life',
      'If it would be expensive to buy',
      'Explain why you find it useful or would like to own it.',
    ],
  },
  {
    id: 'p2-entertainment',
    title: 'A TV show or performance',
    cue: 'Describe a TV show or performance that you enjoy.',
    bullets: [
      'What type of show it is',
      'How often it is on',
      'How popular it is with other people',
      'Explain why you like it.',
    ],
  },
  {
    id: 'p2-exciting-experience',
    title: 'An exciting experience',
    cue: 'Describe an exciting experience you have had.',
    bullets: [
      'When it was',
      'Where you were',
      'What it was',
      'Explain what made this experience especially exciting.',
    ],
  },
  {
    id: 'p2-family-gathering',
    title: 'A family gathering',
    cue: 'Talk about the last time your whole family got together.',
    bullets: [
      'Where you met',
      'What you did together',
      'How long you spent together',
      'Explain if you would like to do the same thing again soon.',
    ],
  },
  {
    id: 'p2-famous-food',
    title: 'A famous food',
    cue: 'Describe a famous food from your hometown or country.',
    bullets: [
      'What it looks like',
      'What it tastes like',
      'When and how it is usually eaten',
      'Explain why you think it is famous.',
    ],
  },
  {
    id: 'p2-meal-out',
    title: 'A meal eaten out',
    cue: 'Describe a meal that you ate out or enjoyed with others.',
    bullets: [
      'Where you went',
      'What you ate',
      'Who you went with',
      'Explain why you remember this meal.',
    ],
  },
  {
    id: 'p2-garden-park',
    title: 'A garden or park',
    cue: 'Describe a garden or park you enjoyed visiting.',
    bullets: [
      'Where it was',
      'What it looked like',
      'What you did there',
      'Explain why you liked it.',
    ],
  },
  {
    id: 'p2-healthy-activity',
    title: 'A healthy activity',
    cue: 'Describe something healthy you enjoy doing.',
    bullets: [
      'What you do',
      'Where you do it',
      'Who you do it with',
      'Explain why you think doing this is healthy.',
    ],
  },
  {
    id: 'p2-historical-place',
    title: 'A historical place',
    cue: 'Describe a historical place that you have visited.',
    bullets: [
      'What kind of place it is',
      'Where it is located',
      'What the historical significance is',
      'Describe your experience of the place.',
    ],
  },
  {
    id: 'p2-dream-holiday',
    title: 'A dream holiday',
    cue: 'Talk about your dream holiday or a memorable vacation.',
    bullets: [
      'Where you would like to go',
      'What kind of accommodation you would like',
      'What activities you would like to do',
      'Explain why you would like to go on a holiday like that.',
    ],
  },
  {
    id: 'p2-important-building',
    title: 'An important building',
    cue: 'Describe an important building in your hometown or city.',
    bullets: [
      'Where it is',
      'What it looks like',
      'What it is used for',
      'Explain why you think it is important.',
    ],
  },
  {
    id: 'p2-website',
    title: 'A website you use',
    cue: 'Describe a website that you often use.',
    bullets: [
      'What type of website it is',
      'How you found out about it',
      'What it allows you to do',
      'Explain why you find it useful.',
    ],
  },
  {
    id: 'p2-language-method',
    title: 'Language learning method',
    cue: 'Talk about one method of learning a foreign language you have used.',
    bullets: [
      'What you did',
      'How long you have used this method',
      'How it compares to other methods',
      'Explain if you will use that same method in the future.',
    ],
  },
  {
    id: 'p2-lake-river',
    title: 'A lake or river',
    cue: 'Describe an important lake or river in your country.',
    bullets: [
      'Where it is located',
      'How big or long it is',
      'What it looks like',
      'Explain why it is important.',
    ],
  },
  {
    id: 'p2-late-time',
    title: 'A time you were late',
    cue: 'Describe a time you were late for something.',
    bullets: [
      'When it was',
      'Why you were late',
      'How people reacted to you being late',
      'Explain what happened because you were late.',
    ],
  },
  {
    id: 'p2-appliance',
    title: 'A household appliance',
    cue: 'Describe the most useful household appliance that you have.',
    bullets: [
      'What it is',
      'How it works',
      'How life would be without it',
      'Explain why it is so important to you.',
    ],
  },
  {
    id: 'p2-forgot-something',
    title: 'An occasion you forgot something',
    cue: 'Describe an occasion when you forgot something important.',
    bullets: [
      'What you forgot',
      'How important it was',
      'Possible reasons why you forgot it',
      'Explain if you think this will happen again.',
    ],
  },
  {
    id: 'p2-favourite-song',
    title: 'A favourite song or instrument',
    cue: 'Describe your favourite song or a musical instrument you would like to play.',
    bullets: [
      'What the song or instrument is',
      'What it sounds like or is about',
      'When you first heard or tried it',
      'Explain why it is your favourite.',
    ],
  },
  {
    id: 'p2-good-news',
    title: 'Good news received',
    cue: 'Describe some good news that you recently received.',
    bullets: [
      'What the news was',
      'How you got the news',
      'Who else you told about it',
      'Explain why this was good news.',
    ],
  },
  {
    id: 'p2-party',
    title: 'A party or celebration',
    cue: 'Describe the best party or celebration you have been to.',
    bullets: [
      'Whose party it was',
      'Who was there',
      'What happened at the party',
      'Explain what made it so enjoyable.',
    ],
  },
  {
    id: 'p2-goal-ambition',
    title: 'A goal or ambition',
    cue: 'Talk about a goal or ambition you have.',
    bullets: [
      'When and why you first set that goal',
      'What you need to do to make it come true',
      'What your next step needs to be',
      'Explain if you think you will achieve that goal.',
    ],
  },
  {
    id: 'p2-photograph',
    title: 'A photograph you like',
    cue: 'Describe a photograph that you like.',
    bullets: [
      'Who is in the photograph',
      'When the photograph was taken',
      'Where the photograph is kept',
      'Explain why you like the photograph.',
    ],
  },
  {
    id: 'p2-shop-street',
    title: 'A shop or shopping street',
    cue: 'Describe a shop or shopping street in your hometown.',
    bullets: [
      'Where it is',
      'What it sells',
      'What the advantages of shopping there are',
      'Explain if you think it will remain popular in the future.',
    ],
  },
  {
    id: 'p2-sport-event',
    title: 'A sport or sporting event',
    cue: 'Talk about a sport you like doing or watching or a sporting event.',
    bullets: [
      'How you first became interested in it',
      'What equipment and skills are needed',
      'Why you are interested in it',
      'Explain why you consider it interesting.',
    ],
  },
  {
    id: 'p2-dream-job',
    title: 'Your dream job or workplace',
    cue: 'Describe your dream job or ideal workplace.',
    bullets: [
      'What kind of things you would do in that job',
      'What the working conditions would be like',
      'What kind of workplace you would work in',
      'Explain if you think you will be able to get a job like that.',
    ],
  },
];

export const PART3: Part3Topic[] = [
  {
    id: 'p3-challenges',
    title: 'Facing Challenges & Difficulties',
    questions: [
      'What challenges do young people face today?',
      'How do young people handle difficult or challenging tasks?',
      'Which do you think is better, to face difficulties alone or to seek the help of others?',
      'Do you think people need to be challenged in life?',
    ],
  },
  {
    id: 'p3-teamwork',
    title: 'Teamwork & Cooperation',
    questions: [
      'In a team, is it more important to pursue individual development or to achieve team targets?',
      'Do you think it’s important for children to join teams to learn to cooperate with others?',
      'Do disagreements among team members have a great influence on teamwork?',
      'How could teamwork be cultivated in classes at school?',
    ],
  },
  {
    id: 'p3-advertising',
    title: 'Advertising & Consumerism',
    questions: [
      'What are popular types of advertising in today’s world?',
      'What type of media advertising do you like most?',
      'Do you think advertising influences what people buy?',
      'How does advertising influence children?',
      'Is there any advertising that can be harmful to children?',
      'Is advertising really necessary in modern society?',
    ],
  },
  {
    id: 'p3-animals-nature',
    title: 'Animals & Endangered Species',
    questions: [
      'Why do people like to keep pets?',
      'What should we do to protect endangered animals?',
      'Do you support doing experiments on animals?',
      'Why do some people refuse to eat animals?',
      'What happens when some species disappear on earth?',
    ],
  },
  {
    id: 'p3-art-culture',
    title: 'Art & Cultural Activities',
    questions: [
      'How do people in your country feel about art?',
      'Do people in your country prefer music over art?',
      'What are some traditional art forms in your country?',
      'Do you think children should study art in school?',
      'How can children benefit from learning about art?',
      'Do you think the government should provide support for art and cultural activities?',
    ],
  },
  {
    id: 'p3-books-literature',
    title: 'Books & E-books vs Movies',
    questions: [
      'Do people read more nowadays?',
      'In your opinion, how will e-books affect paper books?',
      'What’s the difference between films and books?',
      'Do you think it is important to read the book before watching the movie version of it?',
      'Do boys and girls like the same kinds of books?',
    ],
  },
  {
    id: 'p3-business-globalisation',
    title: 'Business & Globalisation',
    questions: [
      'In your opinion, do business people have to work long hours?',
      'How can a small business grow big?',
      'In your opinion, what skills are required to start a small business?',
      'What are the impacts of globalisation on small and large businesses?',
      'What qualities are required to become a company leader or CEO?',
      'Which do you think is better, to start your own business or to work for someone else?',
    ],
  },
  {
    id: 'p3-change-society',
    title: 'Change & Technological Impact',
    questions: [
      'Do you think change is good?',
      'What are some of the major changes that occur to people throughout their lives?',
      'Is your country changing rapidly?',
      'In what ways have changes in technology changed people’s lives?',
      'Why do some older people find it harder to accept change?',
    ],
  },
  {
    id: 'p3-cities-buildings',
    title: 'City Life & Urban Planning',
    questions: [
      'In your opinion, what makes a city a good one to live in?',
      'What are the advantages and negative aspects of crowded cities?',
      'How can governments improve living standards in crowded cities?',
      'What are the advantages and disadvantages of living in tall buildings?',
      'Would you say urban planning is important for modern cities?',
    ],
  },
  {
    id: 'p3-clothes-uniforms',
    title: 'Clothes, Fashion & Uniforms',
    questions: [
      'Can clothing tell you much about a person in your country?',
      'How has clothing fashion changed over the last few decades?',
      'Why do some companies ask their staff to wear uniforms?',
      'What are the advantages and disadvantages of having uniforms at work or school?',
      'Do you think people wear clothes that reflect their personality?',
    ],
  },
  {
    id: 'p3-companies-service',
    title: 'Companies & Customer Service',
    questions: [
      'What is the difference between big companies and small companies?',
      'What are the good things about working for a big company?',
      'How can a company maintain the quality of the service that it gives to the public?',
      'Do you think it’s important for a company to provide after-sales service?',
    ],
  },
  {
    id: 'p3-daily-routine-happiness',
    title: 'Happiness, Punctuality & Habits',
    questions: [
      'What are a few things that make people happy?',
      'Do you think money makes people happy?',
      'What are the benefits of getting up early in the morning?',
      'Do you think it is important to be punctual?',
      'What kind of situations require people to arrive early?',
    ],
  },
  {
    id: 'p3-decision-making',
    title: 'Decision Making & Advice',
    questions: [
      'Why do some people find it hard to make decisions?',
      'How important is it to get advice from other people when making decisions?',
      'What are some of the most important decisions young people have to make?',
      'Do you agree that parents should make important decisions for their children?',
      'Is it better to make a decision thinking about what you want or what others want?',
    ],
  },
  {
    id: 'p3-eating-habits',
    title: 'Eating Habits & Diet',
    questions: [
      'How are eating habits in your country different now compared to the past?',
      'How healthy is your country’s traditional food?',
      'What is a balanced diet?',
      'How might eating habits change in the coming decades?',
      'Why do different cultures have different table manners?',
    ],
  },
  {
    id: 'p3-education-future',
    title: 'Education & Future Classrooms',
    questions: [
      'How are education priorities today different from those in the past?',
      'What is your opinion on the way languages are taught in schools?',
      'How can the type of school you go to affect career success?',
      'What changes do you think will happen in the classroom in the near future?',
    ],
  },
  {
    id: 'p3-electronic-devices',
    title: 'Electronic Devices & Daily Life',
    questions: [
      'What are the most popular electronic devices in today’s world?',
      'Do you think people spend too much money on electronic devices?',
      'In what ways can electronic devices make our lives harder?',
      'What would the world be like without computers?',
      'Should children be taught to use computers at school?',
    ],
  },
  {
    id: 'p3-environmental-problems',
    title: 'Environmental Problems & Protection',
    questions: [
      'What are some of the main environmental problems in your country?',
      'Why should people be concerned about the environment?',
      'Is water pollution a problem in your country?',
      'How can individuals protect the environment in their daily lives?',
      'Do you think more should be done to protect natural scenic spots?',
    ],
  },
  {
    id: 'p3-family-elderly',
    title: 'Family Dynamics & Elderly Care',
    questions: [
      'Is family important in your country?',
      'Who should be responsible to care for the elderly — family or government?',
      'How has average family size changed in your country in recent decades?',
      'What role do grandparents play in family life in your country?',
      'What are the benefits and drawbacks of multi-generational households?',
    ],
  },
  {
    id: 'p3-festivals-traditions',
    title: 'Traditional Festivals & Culture',
    questions: [
      'What is the importance of traditional festivals?',
      'What is the difference between festivals celebrated now and in the past?',
      'Do you think international celebrations are replacing traditional festivals?',
      'Do you think teenagers should learn about traditions?',
    ],
  },
  {
    id: 'p3-friends-relationships',
    title: 'Friendship & Trust',
    questions: [
      'What is the importance of friends in a person’s life?',
      'Would you like to have a few very good friends or a lot of casual acquaintances?',
      'If you had a problem, would you go to your friends or family? Why?',
      'Is it important to have friends from other countries?',
    ],
  },
  {
    id: 'p3-health-medical',
    title: 'Health, Lifestyle & Healthcare',
    questions: [
      'How can people improve their overall health?',
      'Do elderly people exercise much in your country?',
      'Do you think healthcare should be free for all citizens?',
      'What qualities make someone a good doctor?',
      'Are there differences between how old and young people try to stay healthy?',
    ],
  },
  {
    id: 'p3-history-heritage',
    title: 'History & Learning from the Past',
    questions: [
      'Do you think history is an important subject?',
      'What can we learn by studying history?',
      'Can people learn history effectively from films or TV programs?',
      'What is the effect of technology on how people learn about history?',
    ],
  },
  {
    id: 'p3-holiday-tourism',
    title: 'Holidays & Impact of Tourism',
    questions: [
      'Why do people go on holiday?',
      'How important is it for families to go on holiday together?',
      'Is it better to take a holiday in your own country or abroad?',
      'What are the positive and negative impacts of tourism on local communities?',
      'What kind of holidays will be popular in the future?',
    ],
  },
  {
    id: 'p3-internet-social-media',
    title: 'Internet, E-Commerce & Social Media',
    questions: [
      'How will the Internet change buying habits in the future?',
      'What are the pros and cons of shopping online?',
      'Do you think parents should supervise their children’s use of the Internet?',
      'What are the advantages and disadvantages of using social media?',
      'Are non-social media like television and newspapers still useful?',
    ],
  },
  {
    id: 'p3-jobs-future-ai',
    title: 'Work, Careers & Artificial Intelligence',
    questions: [
      'How will AI (artificial intelligence) affect people’s work in the future?',
      'What are important factors to consider when choosing a career?',
      'When young people choose jobs, is salary or interest more important?',
      'What is the difference between physical work and mental work?',
      'Do you think job satisfaction is more important than salary?',
    ],
  },
  {
    id: 'p3-money-wealth',
    title: 'Money & Teaching Financial Literacy',
    questions: [
      'Is money important to you?',
      'What is the relationship between money and power?',
      'How can parents teach the value of money to their children?',
      'Do you think it is important to teach children money management skills?',
    ],
  },
  {
    id: 'p3-music-singers',
    title: 'Music Industry & Celebrities',
    questions: [
      'What kind of music is popular in your country?',
      'Do you think the government should require all children to learn music?',
      'Do you think the government needs to do more to preserve traditional music?',
      'Why is pop music so popular among young people?',
    ],
  },
  {
    id: 'p3-news-media',
    title: 'News Delivery & Reliability',
    questions: [
      'How do people get their news in today’s society?',
      'How do you think people will get their news in the future?',
      'Do you believe everything you read in the newspaper?',
      'How has social media changed how we consume news?',
      'What is the difference between new media and old media?',
    ],
  },
  {
    id: 'p3-patience-time',
    title: 'Patience & Time Management',
    questions: [
      'What is the general attitude towards arriving somewhere late in your country?',
      'Can modern technology help people manage time better?',
      'Do you think people are less patient now than in the past?',
      'Do you think it is possible to teach people to be more patient?',
    ],
  },
  {
    id: 'p3-rules-laws',
    title: 'Rules, Laws & School Governance',
    questions: [
      'Why do we have rules in society?',
      'What are some examples of rules that exist in schools or workplaces?',
      'Do you think that students themselves should have a say in school rules?',
    ],
  },
  {
    id: 'p3-science-inventions',
    title: 'Science & Rapid Inventions',
    questions: [
      'Do you think science is important for human progress?',
      'Which area of science has been the most important in the last one hundred years?',
      'Do you think there will be negative effects resulting from future technology?',
    ],
  },
  {
    id: 'p3-transport-infrastructure',
    title: 'Transport Systems & Traffic Jams',
    questions: [
      'How do most people travel long distances in your country?',
      'How has transportation improved over recent years?',
      'Do you think traffic jams would be reduced if public transport were free?',
      'Why do more and more people prefer to travel by plane?',
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
