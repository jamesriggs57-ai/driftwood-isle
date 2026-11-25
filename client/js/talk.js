/* =====================================================================
   v1.34 TALK: each islander's own things to say, and little branching conversations (chat trees).
   Text only; main.js runs it (see runChat / askAbout there).

   Tokens: {p} your name, {c} their catchphrase, {isle} the island, {season}, {fruit} the island's fruit.
   [id] in a line is another islander's name. A line that names someone only shows when that islander lives here.

   CHAT[id]   lines for an ordinary chat (one is picked)
   SELF[id]   "Tell me about yourself"
   ISLE[id]   "What do you think of the island?"
   THINK[id]  what they think of particular neighbors (anyone not listed gets a line from THINK_ANY by personality)
   TREES[id]  conversations with choices. A node is { say:[lines], ask:[ { label, f, to:node | say:[lines] } ] }.
              f = friendship points for that answer (only counted once a day). need = a tree id that has to come first.
   ===================================================================== */

export const CHAT = {
  pippa: [
    'I planted a carrot by my door. It\'s only a leaf so far but I talk to it every morning, {c}.',
    'Back home my family grew carrots as far as you could see. Here I grow one. It feels more special somehow.',
    'I pressed a daisy in my scrapbook today! That makes page twelve. Page twelve is the BEST page.',
    'Do you think clouds are soft on top? I think they\'re soft on top and a bit damp underneath.',
    'I tried to hop all the way around {isle} without stopping. I stopped. There was a snail. He needed company.',
    '[bramble] fixed my wobbly chair and pretended it was no big deal. It was a big deal! I sat in it for an hour!',
    'If I ever find a four-leaf clover I\'m going to give it to whoever looks like they need luck the most.',
    'I made a list of my favorite sounds. Number one is rain on a roof. Number two is you saying hi, {c}!',
    'Thunder is the only thing I don\'t like. When it storms I hide under my blanket and hum.',
    '[mabel] taught me how to make tea. I put in too much honey. She said there\'s no such thing. I love her.',
    'I counted the steps from my house to the beach. Three hundred and four! Or three hundred and five. A crab distracted me.',
    'Some days I wake up so happy I can\'t sit still. Today is one of those days, {c}!',
    'I want to grow the biggest pumpkin anyone has ever seen. Big enough to sit in. Maybe live in, a little.',
    'When the {fruit} trees blossom I\'m going to have a picnic under every single one. One a day!',
    'I wrote a song! It goes "hop, hop, hop, hop." I\'m still working on the second verse, {c}.',
  ],
  bramble: [
    'Fixed the creaky step on the museum porch. Nobody asked. Somebody had to.',
    'I was a ship\'s carpenter, years back. Spent more time patching leaks than sailing. Good years, though.',
    'You hear that? That\'s the wind finding every loose board on {isle}. I\'ll get to them.',
    'A wobbly stool is a lie. It promises to hold you and then it doesn\'t. I don\'t make lies, {c}.',
    '[pippa] left flowers on my porch again. I put them in a jar. For the jar\'s sake.',
    '[barley] says stone lasts longer than wood. Sure. And it\'s also cold, heavy and boring. Hmph.',
    'My grandmother made honey cake every winter. I still have the recipe. I still burn it every time.',
    'Whittled a little fish today. Looks more like a potato. I\'m keeping it anyway.',
    'Maple splits clean. Pine smells nice but it\'s soft. Oak takes forever and lasts forever. Remember that, {c}.',
    'I don\'t like crowds. I like one or two people, a quiet porch and a job to do.',
    'Saw you hauling wood the other day. Good. Wood wants to be something.',
    'Rain\'s good for the trees. Bad for my knees. Fair trade, I suppose.',
    'If you ever need a hand with something heavy, ask. ...Don\'t make it a habit.',
    'The sea\'s been calm all week. Makes me suspicious, {c}.',
  ],
  lumi: [
    'I named a star after you last night. It\'s a small one. It blinks when it\'s happy, {c}.',
    'I keep a dream journal. Last night I dreamed the museum was underwater and all the fossils swam home.',
    'Have you ever held a shell up to your ear? Mine said something about the tide. I didn\'t catch the end.',
    'I painted the sea today. It came out purple. I think it was right and the sea was wrong.',
    'Spirals are everywhere if you look. Shells, ferns, the way water drains. Even the way [pippa] runs in circles.',
    'Professor Thistle let me hold an ammonite once. It was older than every story I know, {c}.',
    'I don\'t sleep much when the moon is full. It\'s too bright to waste.',
    'Some evenings the water glows a little at the edges. I like to think it\'s the sea dreaming too.',
    'If you find sea glass, keep the blue ones. Blue ones remember the sky.',
    '[wren] and I sometimes sit on the dock and say nothing at all. It\'s my favorite kind of conversation.',
    'I left a seashell on every windowsill in my house. Now every window hums a little in the wind.',
    'Fog is just clouds that wanted to meet us. Be kind to it, {c}.',
    'I tried to draw the wind once. I ended up drawing the trees it was pushing. That\'s the closest you can get.',
    'Do you think the island remembers the people who used to walk here? I hope it remembers us.',
  ],
  otis: [
    'Did my morning hill climb! Top of {isle} and back before breakfast. New record, {c}!',
    'I once raced a crab along the beach. He went sideways. I went forward. He still won. I don\'t get it.',
    'New smoothie recipe! Banana, kelp, a pinch of sand for crunch. Okay, the sand was an accident.',
    'Fishing is a sport. You stand very, very still, and then BAM! Explosive power, {c}!',
    'Stretch your calves before you run. And after. And in the middle, if you get a chance.',
    '[tobin] and I are training for the Great Island Relay. There are only two of us in it so far. We\'re both winning.',
    'I tried meditating. I lasted nine seconds. That\'s a personal best, {c}.',
    'Every rock on this island is a potential step-up block. Every tree is a pull-up bar. Everything is a gym!',
    'Bugs are amazing athletes. A grasshopper can jump twenty times its body length. I can do two. Two and a bit.',
    'Rest days are important. That\'s what I keep telling myself on rest days, {c}.',
    'I named my muscles. This one\'s Gerald. Say hi to Gerald.',
    'If you see me running at night, I\'m not lost. I\'m training my night eyes!',
    '[clover] asked me what the point of running is if you end up where you started. I\'m still thinking about it.',
    'Hydrate! Water, coconut water, rain water if you\'re desperate. Not sea water. Never sea water, {c}.',
  ],
  mabel: [
    'Did you eat breakfast, dear? You look like you skipped breakfast. Here, have a seed biscuit. ...Oh, I ate it. Sorry.',
    'I have fourteen nieces and nephews back home. I write to every one of them on Sundays. My paw gets so tired.',
    'I\'m knitting a scarf for everyone on {isle}. I\'m on number three. Don\'t tell anyone, it\'s a surprise.',
    'Chamomile for sleep, mint for tummies, lavender for worries. I keep all three in my apron, {c}.',
    '[pippa] put six spoons of honey in her tea. Six! I told her that\'s just right. Young ones need their sweetness.',
    'Did you know the {fruit} trees here grow sweeter on the side that gets the morning sun? I tasted every one to check.',
    'When I was a little mouse I wanted to be a sea captain. Now I\'m too small for the wheel. I steer my kettle instead.',
    'Don\'t stay out in the rain too long, sweetheart. Colds sneak up on you.',
    'I keep a little box of buttons. Every button has a story. That one\'s from my mother\'s coat.',
    '[bramble] pretends he doesn\'t like my jam. He\'s had four jars. Four, {c}.',
    'If you\'re ever feeling low, come knock on my door. There\'s always a kettle on and a chair by the window.',
    'I tried to teach [clover] to knit. She fell asleep holding the needles. Very peacefully, mind you.',
    'A tidy house is a happy house. A messy house is a lived-in house. Both are fine, dear. Both are fine.',
    'You work so hard on this island. Remember to sit down sometimes, {c}.',
  ],
  juniper: [
    'Darling, I\'ve been thinking about curtains. Velvet? Linen? I\'ve been thinking about them for three days, {c}.',
    'Before {isle}, I was on the stage. Twelve seasons. Standing ovations. One small fire. We don\'t discuss the fire.',
    'A room should tell a story. Mine tells the story of someone with impeccable taste. Shocking twist, I know.',
    'I write a little society column for the island. Today\'s headline: "Fern Spotted Wearing Dew. Bold Choice."',
    'Fossils are the original antiques, {c}. A trilobite on the mantel says "I am old money. Very old."',
    '[barley] built me a stone bench. It\'s sturdy, honest and utterly without flair. Rather like Barley. I adore it.',
    'One must never rush a sunset. One must stand facing it, slightly turned, with the breeze doing something lovely to one\'s hair.',
    'I\'ve rearranged my sitting room nine times this week. The chair is finally happy. I can tell.',
    'Do you know what goes with everything, darling? Confidence. And a good lamp.',
    '[pippa] told me my house looked "fancy." I\'ve never been so pleased in all my life, {c}.',
    'I don\'t walk, I promenade. There\'s a difference. It\'s mostly in the chin.',
    'The museum is coming along nicely. I\'d hang the paintings a touch lower, but nobody asked me. Yet.',
    'I received a fan letter once from a seagull. Well. It was a feather on my doorstep. I chose to interpret it.',
    'Life is far too short for ugly mugs, {c}.',
  ],
  clover: [
    'I\'ve been cloud watching since lunch. That one looks like a sandwich. So does that one. I might be hungry.',
    'I invented a system. It\'s called the nap index. Right now it\'s about a seven, {c}.',
    'Fishing is the best hobby. You get to sit down, and if anything happens, it\'s the fish\'s fault.',
    '[otis] asked me to go running. I asked him why. We\'re both still thinking about it.',
    'The best snack is the one you don\'t have to get up for. That\'s just science.',
    'I counted sheep to fall asleep once. Then I realized I was counting my cousins. Very awake after that.',
    'The {fruit} tree near my house drops one right by my door every morning. I think it likes me, {c}.',
    'Did you know if you lie in the grass long enough, bugs forget you\'re there? I\'ve met so many bugs.',
    '[mabel] tried to teach me knitting. I made a very long, very short scarf. It\'s a bookmark now.',
    'I\'m not lazy, I\'m saving energy for something important. I\'ll let you know when it comes up, {c}.',
    'The sea is the laziest thing there is. It just goes back and forth all day. I relate.',
    'I once caught a fish without waking up. Okay, half waking up. It was a small fish.',
    'Rainy days are just the sky saying "stay in, it\'s fine." I listen to the sky, {c}.',
    'If you ever want to do nothing together, I\'m really good at it. I can show you.',
  ],
  hazel: [
    'I buried twelve acorns yesterday and I can only find four. The other eight are going to be trees now, {c}!',
    'Bugs are just tiny people with very good outfits. Look at a beetle sometime. LOOK at it.',
    'I gave every ladybug on the east side a name. Dot, Spot, Dotty, Spotty, Mrs. Dots and Kevin.',
    'Do you think a caterpillar knows it\'s going to be a butterfly? I think it hopes. I hope it hopes.',
    'I ran up three trees before breakfast! Not for any reason. Trees are just there, {c}!',
    '[pippa] and I had a contest for who could find the most flowers. We both won because we stopped counting!',
    'My tail is my favorite thing about me. It\'s like carrying a pillow everywhere.',
    'I found a beetle that was shiny green AND shiny purple at the same time. Nature is showing off!',
    'If you ever need anything found, ask me! Unless it\'s my acorns. I have no idea where those are, {c}.',
    'Bees do a little dance to tell each other where the flowers are! I tried it. Nobody understood. I\'ll keep practicing.',
    'I\'m making a map of every hollow on {isle}. There are forty-one! Forty-two if you count my sock drawer.',
    'Moths are just butterflies that like the moon better. Fair enough!',
    '[otis] says squirrels are natural sprinters. I said I know! Then I sprinted away. Point proven, {c}.',
    'I keep a jar of the prettiest pebbles by my bed. I swap one out every day. It\'s a whole job.',
  ],
  tobin: [
    'Fetch is a sport and I will not be taking questions, {c}!',
    'I want to be the island lifeguard. I\'ve been practicing! I saved a beach ball yesterday.',
    'Dug a hole this morning. Didn\'t find anything. Best hole I\'ve ever dug, though.',
    '[otis] and I race to the dock every morning. I let him win sometimes. He lets me win sometimes. We both know.',
    'You\'re back! I mean, you\'re always around, but you\'re BACK! Hi, {c}!',
    'I carry a stick everywhere. You never know when you\'ll need a stick.',
    'I can smell rain about an hour before it comes. It smells like wet stones and adventure.',
    'Fishing is great! I\'m bad at the waiting part. I\'m great at the getting excited part, {c}!',
    'I tried to catch a seagull once. It was a lot of running and no seagull. Ten out of ten, would do again.',
    '[bramble] showed me how to plane a board. I got sawdust in my ears. Worth it!',
    'Loyalty is the best thing a friend can have. And snacks. Loyalty and snacks.',
    'I\'ve got a whole list of things to be happy about today. You\'re on it! You\'re near the top, {c}!',
    'My tail goes faster when I\'m happy and I can\'t stop it. It\'s been going all day.',
    'If you ever get lost, just shout. I\'ll find you. I\'m really good at finding.',
  ],
  wren: [
    'I collect sea glass. Each piece was a bottle once, carrying something somewhere. Now it just carries light.',
    'I wrote a small poem this morning. "Low tide, the rocks show their secrets. I keep quiet." That\'s all of it, {c}.',
    'Before {isle}, I walked a lot of shores. This is the first one that felt like it wanted me to stay.',
    'The lighthouse keepers I met on my travels all had one thing in common. They hum when they think nobody is listening.',
    '[lumi] says I remember things the way the tide does. Coming back a little different each time.',
    'Flowers on a windy cliff grow small and tough. I think about that sometimes.',
    'There\'s an old song sailors sing about a fox who followed the moon across the water. I like to think it\'s about my grandmother.',
    'I fold paper boats and set them out at dusk. Most sink. One made it past the dock last week.',
    'I don\'t mind being alone. I mind being lonely. They\'re different, {c}.',
    'Shells are letters the sea forgot to send. I\'m keeping them safe until it remembers.',
    'Some places are noisy and empty. {isle} is quiet and full. I like it here.',
    'The wildflowers by the cliffs bloom a day later than the ones in town. They take their time. Good for them.',
    'I keep a list of every sunset I\'ve really watched. Not just seen. Watched. It\'s a short list but I\'m proud of it.',
    'If you ever want to walk somewhere without talking, come find me, {c}.',
  ],
  barley: [
    'Stone doesn\'t rot. Stone doesn\'t warp. Stone doesn\'t care what you think. Respect stone, {c}.',
    'I built the wall behind my house. Every rock picked by hand. Took a summer. Worth it.',
    '[bramble] says wood has character. You know what has character? A rock that\'s been here a million years. Hmph.',
    'Weather\'s turning. I can feel it in my shoulders. Shoulders don\'t lie.',
    'I grow tomatoes. Don\'t tell anyone. I have a reputation.',
    'Good fences make good neighbors. Good stone fences make good neighbors for a hundred years.',
    '[juniper] calls my bench "honest." I think it was a compliment. I\'ve decided it was a compliment.',
    'Clay\'s alright. Clay\'s just stone that hasn\'t made up its mind yet.',
    'Found a fossil in a rock I was splitting. Gave it to the museum. Didn\'t want the fuss.',
    'Everybody wants to talk about the sea. Nobody talks about the ground. The ground holds everything up, {c}.',
    'I don\'t say much. When I do, I mean it. Mostly I mean "hmph."',
    'My father was a mason. His father was a mason. I\'m a mason. I also knit. Don\'t tell anyone that either.',
    'A good shovel is worth more than a fancy chair. Fight me, {c}.',
    'Sat on the hill and watched the sunset. Don\'t make it weird.',
  ],
  marigold: [
    'I made {fruit} jam this morning! The whole kitchen smells like summer, dear.',
    'Wear a scarf when it\'s windy, {c}. I don\'t care if you\'re warm. Wear it for me.',
    'I keep spare mittens by my door for anyone who forgot theirs. Nobody ever forgets theirs. I still keep them.',
    'Rosemary by the door for remembering, sage by the window for wisdom, and a mint pot for no reason at all.',
    '[mabel] and I swap recipes every week. Hers are better. Don\'t tell her I said so, she\'ll get modest.',
    'Hedgehogs roll into a ball when they\'re scared. I mostly just make tea. Same idea, really.',
    'I pressed some petals between the pages of my recipe book. Now every recipe smells like roses.',
    'Have you been drinking water? You look a bit dry. Here, sit down. Just for a moment.',
    'I\'ve got a little patch of chamomile behind my house. On calm evenings you can smell it from the path.',
    '[hazel] brought me a beetle as a gift. It was very shiny. I named it Gerald. It left. Gerald is free now.',
    'A good jar of jam can fix most things. The rest needs a hug and a nap, dear.',
    'I count the bees in my garden every morning. Not to be nosy. Just to say good morning to each one.',
    'When I was young I wanted to run a little tea shop by the sea. Now I live by the sea and give tea away. Even better.',
    'Don\'t you work too hard, {c}. The island will still be here tomorrow.',
  ],
};

export const SELF = {
  pippa: ['Me? I\'m Pippa! I grew up on a carrot farm on the mainland with about a hundred brothers and sisters.', 'It got a bit crowded, so I hopped on a boat to find a place where I could hear myself think. Then I found {isle} and stopped thinking and started hopping!'],
  bramble: ['Not much to tell. Spent twenty years as a ship\'s carpenter. Patched every hull between here and the cold seas.', 'Got tired of the moving. Wanted a porch that stays put. This one does. Mostly.'],
  lumi: ['I\'m a painter, mostly. Sometimes a stargazer. On Tuesdays I\'m a person who stares at puddles.', 'I came here because someone told me the stars over {isle} are the clearest anywhere. They were right.'],
  otis: ['I\'m Otis! Mountain goat by blood, island goat by choice. I climbed every peak back home before I was ten!', 'Then I ran out of peaks, so now I climb the same hill every day and pretend it\'s a new one.'],
  mabel: ['Oh, there\'s not much to me, dear. I bake, I knit, I worry. Mostly I worry.', 'My family is large and loud and I love every one of them. I came here for the quiet and I write them every week so they don\'t forget my voice.'],
  juniper: ['Darling, how long do you have? I was a leading lady for twelve seasons. "The Doe of the Dunes." "Antlers at Dawn." Classics, all of them.', 'Then one day I thought, enough applause. I want a little cottage and a view. Here I am. The applause still follows me, in a sense.'],
  clover: ['I\'m Clover. I like naps, snacks and naps. I said naps twice because they\'re twice as important.', 'I moved here because someone said island life is slow. They undersold it. It\'s perfect.'],
  hazel: ['I\'m Hazel! I like bugs, flowers, trees, acorns, pebbles, the color green and you!', 'I used to live in a big forest where everyone was in a hurry. Here, even the hurrying is relaxed.'],
  tobin: ['I\'m Tobin! I\'m a good boy. Well, a good friend. Both! I\'m both, {c}!', 'I came with my family\'s fishing boat once and liked it so much I just stayed. They send me letters. I wag at every one.'],
  wren: ['I\'ve been a lot of places. A lighthouse, a ferry, a cliff town where it rained every day for a year.', 'I always left. Here, I keep finding reasons not to. I think that means something.'],
  barley: ['I\'m a stonemason. My family\'s been cutting stone longer than anyone can remember.', 'Came here because there\'s good rock on {isle} and nobody bothering it. Then people started bothering me. It\'s fine. I like it.'],
  marigold: ['I\'m Marigold, dear. I make jam, grow herbs, and fuss over people. I\'m very good at the fussing.', 'I spent years looking after a big old house full of guests. Now I just look after whoever wanders past my garden. Including you.'],
};

export const ISLE = {
  pippa: ['It\'s the best island in the whole world! Every day there\'s a new flower or a new bug or a new cloud shape!', 'I hope we never leave. I hope we just keep making it nicer forever, {c}.'],
  bramble: ['Good bones. Decent trees. The dock needs work, but the dock always needs work.', 'It\'s home. Don\'t make me say it twice.'],
  lumi: ['It feels like a place halfway between a dream and a map. Do you know what I mean?', 'Some nights, when the wind is right, I think the whole island is breathing.'],
  otis: ['Great terrain! Hills for climbing, beaches for sprints, rivers for jumping over. Ten out of ten!', 'If we ever get a track around the edge, I\'ll run it every single day. Hint hint, {c}.'],
  mabel: ['It\'s lovely, dear. Everyone looks after each other. That\'s rarer than you\'d think.', 'And you\'re a big part of that, {p}. Don\'t think I haven\'t noticed.'],
  juniper: ['It has potential, darling. Real potential. With a few more lamps and a touch of drama it could be iconic.', 'The light in the evening is extraordinary. Like a stage after the curtain call.'],
  clover: ['It\'s soft. The grass is soft, the wind is soft, the days are soft. Ten naps out of ten.', 'Don\'t change it too much. Actually, change it however you want. Just leave my napping spot.'],
  hazel: ['There are so many trees! And every tree has a hollow, and every hollow has a story!', 'I think {isle} is the kind of place you could explore for a hundred years and still find something new, {c}.'],
  tobin: ['It\'s the best! Sticks everywhere, water everywhere, friends everywhere!', 'And it smells amazing. Salt and grass and {fruit}. If happy had a smell, it would be this.'],
  wren: ['Quiet in the right ways. Loud in the right ways too, when the waves come in.', 'I\'ve walked a lot of islands. This one listens back.'],
  barley: ['Good rock. Good soil. Too many people wanting to chat. Present company... tolerated.', 'It\'ll be here long after all of us. That\'s the kind of place worth working on.'],
  marigold: ['It\'s a garden, dear. The whole island. Everyone just tends a different patch.', 'And you\'ve tended more than most, {p}. You should be proud.'],
};

// What they think of particular neighbors
export const THINK = {
  pippa: { bramble:'Bramble is grumpy on the outside and marshmallow on the inside. I\'m not supposed to know that.', mabel:'Mabel is like a warm blanket that also bakes. I love her SO much.', clover:'Clover is the best at doing nothing. I tried to do nothing once and I lasted four seconds.', hazel:'Hazel is my flower-hunting partner! We\'re unstoppable! Unless there\'s a butterfly.', otis:'Otis is so fast! I tried to race him and he did a lap while I was still saying "ready."' },
  bramble: { pippa:'The rabbit? Loud. Cheerful. Leaves flowers everywhere. ...She\'s alright.', barley:'Barley thinks stone beats wood. He\'s wrong. We\'ve been arguing about it for years. Good fella, though.', mabel:'Mabel feeds me whether I\'m hungry or not. I don\'t complain. Much.', tobin:'The pup has good hands for carpentry. Keeps getting sawdust in his ears. He\'ll learn.' },
  lumi: { wren:'Wren understands silence. Not many people do.', pippa:'Pippa is like a sunrise that talks. It\'s a lot. I love it.', juniper:'Juniper is a painting that thinks it\'s a play. Or a play that thinks it\'s a painting.', otis:'Otis moves so much. I wonder if he dreams about sitting still.' },
  otis: { tobin:'Tobin is my training partner! Best attitude on the island. Questionable stretching form.', clover:'Clover is my greatest mystery. How does she do so little and look so happy?', bramble:'Bramble lifts logs like they\'re nothing. I asked him his routine. He said "work." Inspirational.', hazel:'Hazel can climb a tree faster than I can climb a hill. I\'m studying her technique.' },
  mabel: { pippa:'Pippa is a sweet thing. A bit too much sugar in her tea, but who am I to judge.', bramble:'Bramble is a dear. He hides it under a lot of grumbling, but he\'s a dear.', clover:'Clover needs looking after. Not because she can\'t. Just because it\'s nice to.', marigold:'Marigold and I could talk recipes until the sun comes up. We have, once.' },
  juniper: { barley:'Barley is a rock in every sense. Steady, reliable and almost entirely silent. I find it restful.', pippa:'Pippa is an ingenue. Pure heart, no guile. Every production needs one.', lumi:'Lumi is the only one on the island with a true artist\'s soul. Besides me, naturally.', clover:'Clover has mastered the art of reclining. I mean that sincerely. It\'s a lost art.' },
  clover: { otis:'Otis is nice. He makes me tired just watching him. That\'s a compliment. Being tired is great.', mabel:'Mabel tucks a blanket on me if I nap outside. She thinks I don\'t notice. I notice. It\'s the best.', pippa:'Pippa is like a little alarm clock that\'s happy to see you.', barley:'Barley doesn\'t talk much. We sit together sometimes. It\'s very relaxing.' },
  hazel: { pippa:'Pippa is my best flower friend! And my best friend friend!', otis:'Otis says I\'m a natural sprinter. I AM. Watch! ...Okay, I\'ll show you later.', marigold:'Marigold named my beetle Gerald. Gerald loves her. I love her. Everyone loves her.', lumi:'Lumi tells me which stars are bugs. Well, which ones look like bugs. There\'s a beetle one!' },
  tobin: { otis:'Otis is my running buddy! He\'s the fastest! Except for me! Sometimes!', bramble:'Bramble is teaching me woodworking. He says "hmph" a lot but he means "good job."', clover:'Clover let me nap on her porch once. Best nap ever. She didn\'t even wake up when I left.', wren:'Wren is quiet but she always throws the stick really far. That\'s how you know someone cares.' },
  wren: { lumi:'Lumi sees the world in colors I don\'t have names for. I like walking next to her.', barley:'Barley pretends nobody\'s watching when he waters his tomatoes. I never tell.', tobin:'Tobin is all heart, all the time. It\'s good to have someone like that around.', juniper:'Juniper performs even when she\'s alone. I find that very honest, in a way.' },
  barley: { bramble:'Bramble\'s good with wood. I\'ll never tell him. He\'d be insufferable.', juniper:'Juniper talks a lot. Says nice things about my bench, though. I\'ll allow it.', clover:'Clover sits with me sometimes. Doesn\'t ask anything. Best company on the island.', marigold:'Marigold keeps trying to give me a scarf. I have four now. I wear all of them.' },
  marigold: { mabel:'Mabel is the dearest friend I\'ve made in years. Don\'t tell her that, she\'ll cry, and then I\'ll cry.', hazel:'Hazel is a whirlwind with a fluffy tail. She brings me the strangest gifts. I keep every one.', barley:'Barley is a big softie with a hard hat on. Metaphorically. He did say thank you for the scarves.', pippa:'Pippa is pure sunshine. I make her a little extra jam every batch.' },
};
// Anyone not listed above: by personality. {n} is the neighbor's name.
export const THINK_ANY = {
  cheerful:['{n}? Oh, {n} is great! Everyone on {isle} is great! You\'re great!','I like {n}! We wave every morning. Sometimes twice!'],
  gruff:['{n}. They\'re alright. Keeps to themselves. I respect that.','{n}? Hmph. Fine neighbor. Don\'t tell them I said so.'],
  dreamy:['{n} has a nice way of standing still. Have you noticed?','I think {n} is the kind of person who would be a lighthouse, if people could be lighthouses.'],
  sporty:['{n}? Solid neighbor! I\'m going to get them stretching one of these days.','{n} has good energy! Not running energy, but good energy.'],
  caring:['{n} is a dear. I keep meaning to bring them a pie.','I worry {n} doesn\'t eat enough. I worry everyone doesn\'t eat enough, dear.'],
  elegant:['{n}? Charming, in an understated way. Not everyone can be a leading role, darling.','{n} has a certain something. I\'m still deciding what.'],
  lazy:['{n} is nice. I don\'t know much else. I haven\'t asked. Asking is a lot of work.','{n}? Good neighbor. Quiet. Very good for napping near.'],
};

/* Little conversations with choices. They come up now and then when you chat (one a day at most). */
export const TREES = {
  pippa: [
    { id:'pippa_pumpkin', say:['{p}! Can I tell you a secret? A big one?'], ask:[
      { label:'Of course!', f:1, to:{ say:['I want to grow a pumpkin so big I can sit in it. Like a little orange house!','Do you think that\'s silly?'], ask:[
        { label:'Not silly at all', f:2, say:['Really?! Then I\'m going to do it! I\'ll invite you over! You can sit in the pumpkin too, {c}!'] },
        { label:'A little silly. I love it.', f:1, say:['Hehe, silly is my favorite kind of good! Thank you, {p}!'] },
        { label:'Where would you put the door?', f:2, say:['Oh! I hadn\'t thought about the door! A round one! With a carrot knob! You\'re a genius, {c}!'] } ] } },
      { label:'Is it about carrots?', f:1, say:['...How did you know? No wait, it\'s not about carrots. This time. It\'s about pumpkins. Maybe next time, {c}!'] } ] },
    { id:'pippa_storm', say:['Um, {p}? Do you get scared of anything?'], ask:[
      { label:'Sometimes. Do you?', f:2, to:{ say:['Thunder. When it booms I hide under my blanket and hum really loud.','It works a little. Mostly I just get very good at humming.'], ask:[
        { label:'Next storm, come over. We\'ll hum together.', f:3, say:['You\'d do that? That\'s... that\'s the nicest thing, {c}. Okay. Deal. I\'ll bring snacks!'] },
        { label:'Humming is a great plan', f:1, say:['Right? Thunder can\'t get you if you\'re humming. That\'s a rule. I made it up, but it\'s a rule.'] } ] } },
      { label:'Not really!', f:0, say:['Wow, you\'re so brave! I\'m going to be brave like you. Starting... tomorrow. Probably, {c}.'] } ] },
    { id:'pippa_song', need:'pippa_pumpkin', say:['I\'ve been writing a song about {isle}! Want to hear the first line?'], ask:[
      { label:'Yes please!', f:2, to:{ say:['"Oh {isle}, you\'re green and blue, the sea is big and so are you!"','...Is the island big? I couldn\'t think of anything else that rhymed.'], ask:[
        { label:'It\'s perfect', f:2, say:['Perfect?! I\'m going to sing it at breakfast every day now. You\'ve been warned, {c}!'] },
        { label:'"...and I love it through and through"?', f:3, say:['OH. That\'s so good! Can I use it? I\'m putting your name in the credits! Song by Pippa and {p}!'] } ] } },
      { label:'Maybe later', f:0, say:['Okay! It\'ll be even better later anyway. Songs get better when they rest, {c}.'] } ] },
  ],
  bramble: [
    { id:'bramble_ship', say:['You ever been on a ship in a real storm, {p}?'], ask:[
      { label:'No. What\'s it like?', f:2, to:{ say:['Loud. Wet. Every board talking at once. You learn which ones are lying.','Had a mast crack once, middle of the night. Fixed it with rope, a spare oar and a lot of words I won\'t repeat.'], ask:[
        { label:'Do you miss it?', f:2, say:['...Some nights. Then I sit on my porch, and the porch doesn\'t move, and I don\'t miss it so much. {c}.'] },
        { label:'That sounds terrifying', f:1, say:['It was. Then it wasn\'t. That\'s most things, if you live long enough.'] } ] } },
      { label:'Just a little rowboat', f:1, say:['Rowboat\'s honest. You can see every board. Nothing to hide. Good start, {c}.'] } ] },
    { id:'bramble_cake', say:['Hrm. You know anything about baking?'], ask:[
      { label:'A bit. Why?', f:1, to:{ say:['My grandmother\'s honey cake. I burn it every single time. The recipe says "bake until right."','What does "right" mean? How long is right?'], ask:[
        { label:'Ask Mabel, she\'d love to help', f:2, say:['...She would, wouldn\'t she. She\'d make a whole fuss. Hmph. Maybe I will. Don\'t tell her I asked.'] },
        { label:'Right is when it smells like your grandmother\'s kitchen', f:3, say:['...','That\'s a good answer. That\'s a really good answer. Thank you, {c}.'] },
        { label:'Burnt is a flavor too', f:1, say:['Ha! That\'s what I keep telling myself. Glad somebody agrees.'] } ] } },
      { label:'Nope, not a thing', f:0, say:['Figures. Nobody on this island can bake except Mabel. Hmph. Never mind, {c}.'] } ] },
    { id:'bramble_barley', say:['Settle something. Wood or stone?'], ask:[
      { label:'Wood, obviously', f:2, say:['HA. Knew I liked you. Go tell Barley that. Actually don\'t. He\'ll sulk for a week.'] },
      { label:'Stone', f:0, say:['...You\'ve been talking to Barley. I can tell. He\'s got you brainwashed, {c}.'] },
      { label:'Why not both?', f:1, to:{ say:['Both? Like... a stone base with wood on top?','...','That\'s not a bad idea. Don\'t tell Barley it\'s not a bad idea.'], ask:[
        { label:'Build it together!', f:2, say:['Me and Barley? Building something together? ...We\'d argue the whole time. Might be fun. Hmph. Maybe.'] },
        { label:'Your secret\'s safe', f:1, say:['Good. Now go on, before I say something else nice.'] } ] } } ] },
  ],
  lumi: [
    { id:'lumi_dream', say:['I had a dream about you last night, {p}. Do you want to know what happened?'], ask:[
      { label:'Tell me!', f:1, to:{ say:['You were a lighthouse. A very small one. And all the boats in the sea came to you to ask for directions.','You told each one a different way home, and they all got there. Isn\'t that lovely?'], ask:[
        { label:'What did I look like as a lighthouse?', f:2, say:['Stripy. Red and cream. With a little window at the top where you kept your thoughts. Very handsome, {c}.'] },
        { label:'I\'d be a terrible lighthouse', f:1, say:['No. You\'d be a good one. Lighthouses don\'t have to be perfect. They just have to stay lit.'] } ] } },
      { label:'Was it a good dream?', f:1, say:['It was the kind of dream you wake up from slowly, so you can keep it a little longer. So yes, {c}.'] } ] },
    { id:'lumi_paint', say:['If you could paint {isle} in only one color, which would you choose?'], ask:[
      { label:'Blue, for the sea', f:1, say:['Blue... yes. The island is mostly sea when you think about it. The land is just where the sea stopped to rest.'] },
      { label:'Green, for the trees', f:1, say:['Green is a hopeful color. Things grow when you look at green. I like that you chose it, {c}.'] },
      { label:'Gold, like the evening light', f:2, to:{ say:['Oh... gold. The hour when everything looks like a memory of itself.','I\'m going to paint it that way. Will you come see it when it\'s done?'], ask:[
        { label:'I wouldn\'t miss it', f:2, say:['Then I\'ll paint it slowly, so you have something to look forward to. Is that strange? I think it\'s nice, {c}.'] },
        { label:'Only if I can hang it in my house', f:2, say:['You want it in your house? ...I\'ve never had a painting hung up before. I might cry a little. Happily.'] } ] } } ] },
    { id:'lumi_stars', need:'lumi_dream', say:['I\'ve been naming the stars over {isle}. Would you like to name one too?'], ask:[
      { label:'Name it after you', f:2, say:['After me? Then it should be a quiet one. Over there, the dim one that doesn\'t mind being dim. Thank you, {c}.'] },
      { label:'Name it after the island', f:2, say:['The {isle} star. It\'ll watch over the island every night. Perfect.'] },
      { label:'Call it Kevin', f:1, say:['...Kevin. Yes. Some stars are definitely Kevins. That one, there. He looks like a Kevin. Hehe.'] } ] },
  ],
  otis: [
    { id:'otis_relay', say:['{p}! Big question! Do you want to join the Great Island Relay?'], ask:[
      { label:'Sign me up!', f:2, to:{ say:['YES! That makes three! Me, Tobin, and you! We\'re a real league now!','First event: run to the dock and back. Second event: run to the dock and back faster. Ready?'], ask:[
        { label:'Can I take my bike?', f:1, say:['...That\'s technically not running, but technically there are no rules. Allowed! For now, {c}!'] },
        { label:'Let\'s do it!', f:2, say:['That\'s the spirit! Okay, I\'ll set up the course. It might take a few days. Training starts NOW!'] } ] } },
      { label:'What\'s the prize?', f:1, say:['The prize is the joy of movement! And maybe a coconut. I\'ll find a really good coconut, {c}.'] },
      { label:'I\'ll cheer from the side', f:1, say:['A cheerleader! Every team needs one! Bring a sign that says "GO OTIS." Or "GO EVERYONE." Mostly Otis.'] } ] },
    { id:'otis_smoothie', say:['Want to try my new smoothie? It\'s green. Very green.'], ask:[
      { label:'What\'s in it?', f:1, to:{ say:['Kelp, banana, a mint leaf and something I found on the beach that I\'m pretty sure was a seaweed.','Pretty sure.'], ask:[
        { label:'I\'ll pass, thanks', f:0, say:['More for Gerald! Gerald is my left bicep. He\'s very thirsty, {c}.'] },
        { label:'...Okay, one sip', f:3, say:['A brave one! How is it? You don\'t have to answer. Your face is answering. Respect, {c}.'] } ] } },
      { label:'Sure!', f:2, say:['You didn\'t even ask what\'s in it?! That\'s the trust of a true athlete. It\'s kelp. Mostly kelp, {c}.'] } ] },
    { id:'otis_still', need:'otis_relay', say:['{p}, can I ask you something serious?'], ask:[
      { label:'Of course', f:2, to:{ say:['Clover asked me what the point of running is if you end up where you started.','I didn\'t have an answer. I\'ve been thinking about it all week. What do you think?'], ask:[
        { label:'The point is how it feels on the way', f:3, say:['...How it feels on the way. Huh. Yeah. Yeah! That\'s it! I\'m telling Clover! She\'ll probably be asleep, but I\'m telling her!'] },
        { label:'You don\'t end up the same. You get stronger.', f:2, say:['Oh. OH. Gerald, did you hear that? We\'re not running in circles. We\'re running in spirals! Upward spirals!'] },
        { label:'Maybe there isn\'t one. That\'s okay.', f:1, say:['No point... and that\'s okay... Wow. That\'s so relaxing. Is this how Clover feels all the time? I need to sit down, {c}.'] } ] } },
      { label:'Is it about stretching?', f:0, say:['Ha! No. Well, everything is a little bit about stretching. But no. Never mind, I\'ll ask you another day.'] } ] },
  ],
  mabel: [
    { id:'mabel_eat', say:['Sweetheart, have you eaten today? Be honest with me.'], ask:[
      { label:'Yes, I promise', f:1, say:['Good. Good! Was it something green? ...Never mind, I won\'t pry. Just eat something green tomorrow, {c}.'] },
      { label:'...Not really', f:2, to:{ say:['I knew it! I can always tell. Sit down. No, don\'t argue. Sit.','I\'ve got seed biscuits and a bit of {fruit} tart. Which one?'], ask:[
        { label:'Biscuits, please', f:2, say:['Here you go, dear. Take two. Take three. Take the tin, I\'ll make more. That\'s what I\'m for.'] },
        { label:'The tart sounds amazing', f:2, say:['It is amazing, if I say so myself. Which I do. Eat it all, {c}. Every crumb.'] } ] } },
      { label:'I\'m too busy to eat', f:0, say:['Too busy to EAT? Oh, {p}. Nobody is ever too busy to eat. I\'m going to worry about you all day now.'] } ] },
    { id:'mabel_letters', say:['I\'m writing to my nieces and nephews tonight. Is there anything you\'d like me to tell them about {isle}?'], ask:[
      { label:'Tell them about the sunsets', f:2, say:['The sunsets. Yes. Little Pip will love that, she paints. I\'ll describe every color. All of them, dear.'] },
      { label:'Tell them their aunt is the best', f:3, to:{ say:['Oh, stop it. Stop it!','...','I\'m going to write that down exactly as you said it. And underline it. Twice, {c}.'], ask:[
        { label:'Underline it three times', f:2, say:['Three times! You\'ll make an old mouse cry. Off with you. Go on. Thank you, dear.'] },
        { label:'And sign my name', f:2, say:['From Aunt Mabel and {p}. There. Now they\'ll all want to meet you. Fourteen of them. Good luck, dear.'] } ] } },
      { label:'Tell them to visit!', f:1, say:['Visit? All fourteen of them? On {isle}? ...Oh, the noise. Oh, how lovely that would be.'] } ] },
    { id:'mabel_scarf', need:'mabel_eat', say:['I\'ve been knitting, and I need to know something very important. What\'s your favorite color?'], ask:[
      { label:'Red', f:1, say:['Red! Warm and brave. That suits you. No reason. Just asking. Carry on, {c}.'] },
      { label:'Green', f:1, say:['Green. Like a little garden. Lovely. That\'s all. No reason at all, dear.'] },
      { label:'Are you knitting me a scarf?', f:2, say:['WHAT? No! Who said anything about a scarf? I\'m knitting... a... large, long sock. For the wind. Shoo, {c}!'] } ] },
  ],
  juniper: [
    { id:'juniper_column', say:['Darling, I\'m writing this week\'s society column. Any island gossip for me?'], ask:[
      { label:'Bramble is secretly very sweet', f:2, say:['"Local Bear: Soft Center Confirmed." Oh, it\'s a scoop. He\'ll be furious. I adore it.'] },
      { label:'I\'d never gossip', f:1, say:['Discretion! How refreshing. I\'ll write that instead. "One Islander Remains Mysterious." Readers will be riveted.'] },
      { label:'I caught a huge fish', f:1, to:{ say:['A fish story! Classic. How big, darling? And remember, this is for print.'], ask:[
        { label:'About this big', f:1, say:['"Modestly Sized Fish Caught by Modest Islander." Hmm. I\'ll punch it up in editing.'] },
        { label:'Bigger than the dock', f:2, say:['"Leviathan Landed!" Now THAT is a headline. I won\'t check the facts. Facts are for the evening edition.'] } ] } } ] },
    { id:'juniper_stage', say:['Do you know what I miss about the theater, {p}?'], ask:[
      { label:'The applause?', f:1, say:['Everyone says that. No, darling. The applause was nice. But it was the quiet just before the curtain went up. That I miss.'] },
      { label:'Tell me', f:2, to:{ say:['The moment before the curtain. Everyone holding their breath. Anything could happen.','I get that feeling sometimes here. In the mornings, before anyone\'s awake. As if the island is about to begin.'], ask:[
        { label:'Maybe you should put on a show here', f:3, say:['A show? On {isle}? With... with Clover as the sleeping princess and Otis as the messenger who never stops running? Oh. OH. I need a notebook.'] },
        { label:'That\'s beautiful', f:2, say:['It is, isn\'t it? I\'m glad I said it out loud. Now you can remember it for me, darling.'] } ] } } ] },
    { id:'juniper_decor', need:'juniper_column', say:['I simply must ask. What\'s the centerpiece of your home, darling?'], ask:[
      { label:'A really nice lamp', f:2, say:['A LAMP. Yes. You understand. Light is the soul of a room. I knew I liked you.'] },
      { label:'My bed', f:1, say:['Practical. Sincere. A little bit lazy. I respect it.'] },
      { label:'I don\'t have one yet', f:1, say:['A blank stage! The best kind. Promise me you\'ll start with a good rug. Everything begins with a good rug, darling.'] } ] },
  ],
  clover: [
    { id:'clover_nap', say:['{p}... do you ever just lie down in the grass for no reason?'], ask:[
      { label:'All the time', f:2, say:['Oh. A fellow professional. We should nap together sometime. Not together together. Near each other. Parallel napping.'] },
      { label:'Never. I\'m always busy.', f:1, to:{ say:['Never? Never ever?','That\'s okay. That\'s okay. Can I teach you? It\'s easy. Step one: lie down.'], ask:[
        { label:'...And step two?', f:2, say:['There is no step two. That\'s the beauty of it. Try it today. I\'ll know if you didn\'t. Somehow, {c}.'] },
        { label:'Maybe someday', f:1, say:['Someday is a good day for a nap. All days are. Mm.'] } ] } },
      { label:'Only when I\'m tired', f:1, say:['Wait, you need a reason? Being tired is a great reason. But so is it being Tuesday.'] } ] },
    { id:'clover_cloud', say:['That cloud. Up there. What does it look like to you?'], ask:[
      { label:'A sheep', f:2, say:['...It does. It\'s my cousin. Hi, cousin. ...They didn\'t wave back. Rude, {c}.'] },
      { label:'A sandwich', f:2, say:['YES. Thank you. Everyone always says it\'s a boat. It\'s clearly a sandwich. We see the truth, you and me.'] },
      { label:'Just a cloud', f:0, say:['Just a cloud... Hm. Very zen. Maybe you\'re better at this than me, {c}.'] } ] },
    { id:'clover_fish', need:'clover_nap', say:['Want to know my secret fishing technique? I\'ve never told anyone.'], ask:[
      { label:'Yes!', f:2, to:{ say:['Okay. You cast your line. Then you close your eyes.','And you think about how much you\'d like a snack. The fish can feel it. They come to see what\'s going on.'], ask:[
        { label:'That can\'t possibly work', f:1, say:['It worked yesterday. Twice. Once was a boot, but the boot was very curious, {c}.'] },
        { label:'I\'m going to try it', f:2, say:['Good. Report back. Or don\'t, that\'s a lot of walking. Just nod at me next time and I\'ll know.'] } ] } },
      { label:'Is it falling asleep?', f:1, say:['...Who told you. Was it Mabel? It was Mabel. She found me holding a rod and snoring. Still caught a fish.'] } ] },
  ],
  hazel: [
    { id:'hazel_acorn', say:['{p}! Quick! Have you seen an acorn about this big, with a little scratch on it?'], ask:[
      { label:'No, sorry!', f:1, say:['Drat! That was my favorite one. Oh well. It\'s probably a tree by now. Good luck, little guy, {c}!'] },
      { label:'Want help looking?', f:2, to:{ say:['YES! You check under that bush. I\'ll check... everywhere else!','...','Found it! It was in my cheek the whole time! I forgot I put it there!'], ask:[
        { label:'Classic Hazel', f:2, say:['Hehe, that\'s what everyone says! Here, you can hold it. Just for a second. That\'s a big honor, {c}.'] },
        { label:'How do you forget that?', f:1, say:['I have a LOT of cheek space! Things get lost in there. Once I found a grape from last summer. It was a raisin.'] } ] } } ] },
    { id:'hazel_beetle', say:['If you were a bug, what bug would you be?'], ask:[
      { label:'A butterfly', f:1, say:['A butterfly! Pretty, and kind of floaty, and you visit all the flowers. That\'s so you, {c}!'] },
      { label:'A stag beetle', f:2, say:['A STAG BEETLE?! Tough, shiny, with those amazing horns? Oh, you\'re SO cool. I\'m telling everyone.'] },
      { label:'What would you be?', f:2, to:{ say:['Me? Hmm... A ladybug! Small, round, and everyone\'s happy when they see me!','Or a bee. Busy and fuzzy and good at dancing. Can I be both?'], ask:[
        { label:'You can be both', f:2, say:['A ladybee! I\'m inventing it! It\'s the best bug and it\'s me! Thank you, {c}!'] },
        { label:'Definitely a squirrel', f:1, say:['...That\'s not a bug! But it\'s right. I\'m a squirrel. Fine. Best answer.'] } ] } } ] },
    { id:'hazel_map', need:'hazel_acorn', say:['I\'m making a map of every hollow on the island. Want to see?'], ask:[
      { label:'Of course!', f:2, to:{ say:['Okay, this X is a hollow. This X is also a hollow. This X... I think that\'s where I spilled jam.','Is it a good map?'], ask:[
        { label:'The best map I\'ve ever seen', f:2, say:['REALLY?! I\'m going to frame it! Next to my pebble jar! It\'s going to be famous, {c}!'] },
        { label:'Maybe label the jam', f:1, say:['Good idea! "Jam, not a hollow." There. Now it\'s a professional map.'] } ] } },
      { label:'Is my house on it?', f:1, say:['Your house has a hollow? ...Wait, does it? I\'ll have to check. Expect me to visit, {c}!'] } ] },
  ],
  tobin: [
    { id:'tobin_fetch', say:['{p}! {p}! Wanna play fetch?! You throw, I fetch!'], ask:[
      { label:'Let\'s go!', f:2, say:['YES! Okay, throw it! Throw it as far as you can! ...You threw it into the sea. I\'ll be right back, {c}!'] },
      { label:'Can I fetch this time?', f:2, to:{ say:['You want to fetch?! Nobody ever wants to fetch! Okay, okay, I\'ll throw!','...It went two feet. Sorry. I\'m not a thrower. I\'m a fetcher.'], ask:[
        { label:'Two feet is plenty', f:2, say:['You fetched it! You\'re a natural! We should switch roles every other day, {c}!'] },
        { label:'Let\'s stick to the classics', f:1, say:['Good call. I\'m a fetcher. You\'re a thrower. Destiny!'] } ] } },
      { label:'Maybe later', f:0, say:['Later is good! Later is great! I\'ll hold onto the stick. For later. I\'ll be holding it, {c}.'] } ] },
    { id:'tobin_lifeguard', say:['Do you think I\'d make a good lifeguard?'], ask:[
      { label:'The best on any island', f:3, say:['...I\'m going to remember you said that forever. I\'ll practice extra hard. Nobody gets lost at sea on my watch, {c}!'] },
      { label:'What have you saved so far?', f:1, to:{ say:['A beach ball. A sandal. A crab that didn\'t need saving. He was pretty mad.','And a seagull! Well, I chased a seagull. That counts as saving it from boredom.'], ask:[
        { label:'Sounds like a perfect record', f:2, say:['Right?! Zero losses! Okay, the sandal floated away again after. One loss. One heroic loss.'] },
        { label:'Maybe start with swimming lessons', f:1, say:['I can swim! Dog paddle! It\'s the official stroke of lifeguards everywhere. Probably.'] } ] } } ] },
    { id:'tobin_list', need:'tobin_fetch', say:['I keep a list of things that make me happy. Want to hear what\'s on it today?'], ask:[
      { label:'Yes!', f:2, say:['Sticks. Sunshine. The sound the dock makes when you run on it. Otis. Snacks. And you! Right near the top, {c}!'] },
      { label:'Am I on it?', f:2, say:['You\'re ALWAYS on it! You\'re on it twice! Once for being you, once for asking!'] },
      { label:'What\'s number one?', f:1, say:['Number one is... the first moment of the morning when I remember I live on {isle}. Every day. It gets me every day.'] } ] },
  ],
  wren: [
    { id:'wren_poem', say:['I\'m trying to finish a poem. I need one word. Will you help?'], ask:[
      { label:'Sure', f:1, to:{ say:['"The tide goes out, the gulls go quiet, the island holds its..."','Its what?'], ask:[
        { label:'Breath', f:2, say:['"Holds its breath." Yes. That\'s it. You found it. Thank you, {c}.'] },
        { label:'Lunch', f:1, say:['"...holds its lunch." ...I laughed. I didn\'t expect to laugh. I\'m keeping it, actually.'] },
        { label:'Light', f:2, say:['"Holds its light." Oh. That\'s softer than what I had. I think I like yours better.'] } ] } },
      { label:'I\'m not much of a poet', f:0, say:['Nobody is, until they say the right word by accident. Maybe next time, {c}.'] } ] },
    { id:'wren_boats', say:['I fold paper boats and let them go at dusk. Would you like to fold one with me?'], ask:[
      { label:'I\'d love to', f:2, to:{ say:['You fold it like this, then this, then a little pinch at the front so it knows which way to go.','Now, before you let it go, you\'re supposed to give it a wish. Quietly.'], ask:[
        { label:'(Make a wish)', f:3, say:['...There it goes. I hope yours makes it past the dock. Mine usually don\'t. But I think yours will, {c}.'] },
        { label:'What did you wish for?', f:1, say:['If I tell you, it sinks. That\'s the rule. ...It was a nice wish, though. It had you in it.'] } ] } },
      { label:'Do any of them make it?', f:1, say:['One got past the dock last week. I don\'t know where it is now. I like not knowing.'] } ] },
    { id:'wren_stay', need:'wren_boats', say:['Can I tell you something, {p}?'], ask:[
      { label:'Always', f:2, to:{ say:['I\'ve never stayed anywhere longer than a season. I always felt the next shore calling.','It\'s been longer than a season here. And I don\'t hear it anymore.'], ask:[
        { label:'I\'m glad you\'re staying', f:3, say:['...So am I. I think the island had something to do with it. And you, a little. Thank you, {c}.'] },
        { label:'What changed?', f:2, say:['I think I found something worth staying still for. That\'s all. That\'s everything.'] } ] } },
      { label:'Is it a poem?', f:1, say:['Not yet. Maybe someday it will be. Ask me again in a while.'] } ] },
  ],
  barley: [
    { id:'barley_tomato', say:['...You didn\'t see anything behind my house. Right?'], ask:[
      { label:'You mean the tomatoes?', f:1, to:{ say:['...','Fine. Yes. I grow tomatoes. They need someone. Somebody\'s got to stake them up proper.'], ask:[
        { label:'Your secret\'s safe', f:3, say:['Good. ...Here. Have one, next time they\'re ripe. Don\'t make a thing of it, {c}.'] },
        { label:'They look amazing', f:2, say:['They do, don\'t they. Stone wall keeps the wind off. Stone. See? Stone helps everything. Tell Bramble that.'] } ] } },
      { label:'Nothing at all', f:2, say:['Good. Good answer. You\'re alright, {c}.'] } ] },
    { id:'barley_wall', say:['Built a wall once that\'s still standing. Hundred years, they say it\'ll last.'], ask:[
      { label:'That\'s amazing', f:1, say:['It\'s a wall. But yeah. It is. Thanks, {c}.'] },
      { label:'What\'s the secret?', f:2, to:{ say:['No secret. Pick every stone by hand. Turn it till it sits right. Don\'t rush.','Most folks rush. Rushing makes walls fall down. Makes most things fall down.'], ask:[
        { label:'That\'s good advice for life too', f:3, say:['...Huh. Yeah. Never thought of it that way. My father used to say that. Didn\'t understand him till now.'] },
        { label:'Can you teach me?', f:2, say:['Teach you? Hmph. Come by with a good rock sometime. Not a pretty one. A good one. You\'ll know it when you lift it.'] } ] } } ] },
    { id:'barley_knit', need:'barley_tomato', say:['Hmph. You ever... knit?'], ask:[
      { label:'A little. You?', f:2, to:{ say:['My grandmother taught me. Big hands, small needles. Took years.','Made a scarf for Marigold. She keeps giving me scarves. Figured it was time to give one back.'], ask:[
        { label:'She\'s going to love it', f:3, say:['You think? It\'s lumpy. Brown. Looks like a road. ...You think she\'ll love it? Hmph. Good.'] },
        { label:'Two secrets now, Barley', f:2, say:['Don\'t count them. You\'re keeping them both. I trust you, {c}. That\'s not nothing.'] } ] } },
      { label:'No. Why?', f:0, say:['No reason. Forget I asked. Hmph.'] } ] },
  ],
  marigold: [
    { id:'marigold_scarf', say:['Oh, {p}, look at you. Where\'s your scarf?'], ask:[
      { label:'I don\'t have one', f:1, to:{ say:['You don\'t HAVE one? Oh, that won\'t do at all. I\'ll knit you one this week.','What color? Quick, before I decide for you.'], ask:[
        { label:'Anything you like', f:2, say:['Anything? Then it\'s going to be every color. Patchwork. Bold. You\'ll be seen from the boats, dear.'] },
        { label:'Something cozy', f:2, say:['Cozy. Oatmeal and cream with a little stripe of {fruit}. I can see it already. Done.'] } ] } },
      { label:'It\'s not that cold!', f:0, say:['Not that cold? Not that COLD? That\'s how it gets you, dear. The not-that-cold days. Wrap up.'] } ] },
    { id:'marigold_tea', say:['I\'ve got a pot of tea on. What do you need today, dear? Calm, cheer or courage?'], ask:[
      { label:'Calm', f:2, say:['Chamomile with a bit of honey. Sip slowly and look at something green. There. Better already, {c}.'] },
      { label:'Cheer', f:2, say:['Lemon balm and a slice of {fruit}. And a biscuit. Cheer always comes with a biscuit.'] },
      { label:'Courage', f:2, to:{ say:['Courage. Ginger and a pinch of pepper. It bites a little. That\'s the point.','What do you need courage for, dear? You don\'t have to say.'], ask:[
        { label:'Just life, I guess', f:3, say:['Just life. That\'s the biggest one of all. Here, have the whole pot. And come back tomorrow for more.'] },
        { label:'I\'d rather not say', f:2, say:['Then I won\'t ask. Drink up. Whatever it is, you\'ve got this, {c}.'] } ] } } ] },
    { id:'marigold_shop', need:'marigold_tea', say:['Can I tell you a silly dream of mine?'], ask:[
      { label:'Please do', f:2, to:{ say:['A little tea shop. By the water. Mismatched cups. Jam on every table.','Silly, isn\'t it? At my age.'], ask:[
        { label:'Not silly. You already run one.', f:3, say:['...Do I? My kitchen? With all of you coming by? Oh. Oh, I suppose I do. Thank you, dear. I needed that.'] },
        { label:'I\'d be your first customer', f:2, say:['First customer gets free jam for life. That\'s a promise. Write it down, {c}.'] } ] } },
      { label:'Is it about jam?', f:1, say:['Everything is a little bit about jam, dear. But no. Another day.'] } ] },
  ],
};

// Trees anyone can have, by personality (for trip townsfolk and anyone without their own)
export const TREES_ANY = {
  cheerful:[{ id:'any_cheer', say:['What\'s the best thing that happened to you today, {p}?'], ask:[
    { label:'Talking to you', f:2, say:['Aww! Now that\'s the best thing that happened to ME today too, {c}!'] },
    { label:'Nothing yet', f:1, say:['Then it\'s still coming! The best ones always show up late, {c}!'] } ] }],
  gruff:[{ id:'any_gruff', say:['Hrm. You staying out of trouble?'], ask:[
    { label:'Mostly', f:1, say:['Mostly is honest. I can work with mostly, {c}.'] },
    { label:'Never', f:2, say:['Ha. Good. Trouble\'s where the stories are.'] } ] }],
  dreamy:[{ id:'any_dream', say:['If the sea could talk, what do you think it would say?'], ask:[
    { label:'"Come in, the water\'s fine"', f:1, say:['Hehe. Maybe. Or "please stop putting boats on me." We\'ll never know, {c}.'] },
    { label:'"Thank you for listening"', f:2, say:['Oh... yes. I think that\'s exactly what it would say.'] } ] }],
  sporty:[{ id:'any_sport', say:['Quick! Ten jumping jacks! Go!'], ask:[
    { label:'(Do them)', f:2, say:['YES! Look at you go! That\'s ten! Okay, eleven. I lost count. Great form, {c}!'] },
    { label:'Maybe two', f:1, say:['Two is better than zero! Zero is the enemy! Good job, {c}!'] } ] }],
  caring:[{ id:'any_care', say:['Are you sleeping well, dear?'], ask:[
    { label:'Like a log', f:1, say:['Good. Logs are excellent sleepers. Very still. Keep it up, {c}.'] },
    { label:'Not really', f:2, say:['Oh, sweetheart. Warm milk, a dark room and no thinking about tomorrow. Try it tonight.'] } ] }],
  elegant:[{ id:'any_elegant', say:['Darling, be honest. How do I look today?'], ask:[
    { label:'Stunning', f:2, say:['I know. But it\'s lovely to hear it. You have excellent taste, {c}.'] },
    { label:'Same as always', f:1, say:['Consistently magnificent. I\'ll take it.'] } ] }],
  lazy:[{ id:'any_lazy', say:['Hey. What\'s your favorite snack?'], ask:[
    { label:'Fruit', f:1, say:['Fruit. Good. Grows on trees. Barely any effort. Smart, {c}.'] },
    { label:'Whatever you\'re having', f:2, say:['...You want half? I don\'t usually share. You\'re different, though. Here.'] } ] }],
};
