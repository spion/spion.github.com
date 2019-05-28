---
title: Machine learning ethics
description: Can be terrifying.
date: 2017-12-19
layout: post.pug
hidden: false
---

Today I found and watched one of the most important videos on machine learning published this year

> We're building a dystopia just to make people click on ads
> https://www.youtube.com/watch?v=iFTWM7HV2UI&app=desktop

Go watch it first before reading ahead! I could not possibly summarise it without doing it a
disservice.

What struck me most was the following quote:

> Having interviewed people who worked at Facebook, I'm convinced that nobody there really
> understands how it [the machine learning system] works.

The important question is, howcome nobody understands how a machine learning system works? You
would think, its because the system is very complex, its hard for any one person to understand it
fully. Thats not the problem.

The problem is fundamental to machine learning systems.

A machine learning system is a program that is given a target goal, a list of possible actions,
a history of previous actions and how well they achieved the goal in a past context.
The system should learn on the historical data and be able to predict what action it can select to
best achieve the goal.

Lets see what these parts would represent on say, YouTube, for a ML system that has to pick which
videos to show on the sidebar right next to the video you're watching.

The target goal could be e.g. to maximise the time the user stays on YouTube, watching videos.
More generally, a *value function* is given by the ML system creator that measures the desireability
of a certain outcome or behaviour (it could include multiple things like number of product bought,
number of ads clicked or viewed, etc).

The action the system can take is the choice of videos in the sidebar. Every different set of videos
would be a different alternative action, and could cause the user to either stay on YouTube longer
or perhaps leave the site.

Finally, the history of actions includes all previous video lists shown in the sidebar to users,
together with the value function outcome from them: the time the user spent on the website after
being  presented that list. Additional context from that time is also included: which user was it,
what was their personal information, their past watching history, the channels they're subscribed
to, videos they liked, videos they disliked and so on.

Based on this data, the system learns how to tailor its actions (the videos it shows) so that it
achieves the goal by picking the right action for a given context.

At the beginning it will try random things. After several iterations, it will find which things
seem to maximize value in which context.

Once trained with sufficient data, it will be able to do some calculations and conclude: "well,
when I encountered a situation like this other times, I tried these five options, and option two
on average caused users like this one to stay the longest, so I'll do that".

Sure, there are ways to ask some ML systems why they made a decision after the fact, and they can
elaborate the variables that had the most effect. But before the algorithm gets the training data,
you *don't* know what it will decide - nobody does! It learns from the history of its own actions
and how the users reacted to them, so in essence, the users are programming its behaviour (through
the lens of its value function).

Lets say the system learnt that people who have cat videos in their watch history will stay a lot
longer if they are given cat videos in their suggestion box. Nothing groundbreaking there.

Now lets say it figures out the same action is appropriate when they are watching something
unrelated, like academic lecture material, because past data suggests that people of that profile
leave slightly earlier when given more lecture videos, while they stay for hours when given cat
videos, giving up the lecture videos.

This raises a very important question - is the system behaving in an ethical manner? Is it ethical
to show cat videos to a person trying to study and nudge them towards wasting their time? Even that
is a fairly benign example. There are far worse examples mentioned in the TED talk above.

The root of the problem is the value function. Our systems are often blisfully unaware of any side
effects their decision may cause and blatantly disregard basic rules of behaviour that we take for
granted. They have no other values than the value function they're maximizing. For them, the end
justifies the means. Whether the value function is maximized by manipulating people, preying on
their insecurities, making them scared, angry or sad - all of that is unimportant. Here is a scary
proposition: if a person is epileptic, it might learn that the best way to keep thenm "on the website"
is to show them something that will render them unconscious. It wouldn't even know that it didn't
really achieve the goal: as far as it knows, autoplay is on and they haven't stopped it in the past
two hours, so it all must be "good".

So how do we make these systems ethical?

The first challenge is technical, and its the easiest one. How do we come up with a value function
that encodes additional basic values of of human ethics? Its easy as pie! You take a bunch of
ethicists, give them various situations and ask them to rate actions as ethical/unethical. Then once
you have enough data, you train a new value function so that the system can learn some basic humanity.
You end up with a an ethics function, and you create a new value function that combines the old
value function with the ethics function into the new value function. As a result the system starts
picking more ethical actions. All done. (If only things were that easy!)

The second challenge is a business one. How far are you willing to reduce your value maximisation
to be ethical? What to do if your competitor doesn't do that? What are the ethics of putting a
number on how much ethics you're willing to sacrifice for profits? (Spoiler alert: they're not
great)

One way to solve that is to have regulations for ethical behaviour of machine learning systems.
Such systems could be held responsible for unethical actions. If those actions are reported by
people, investigated by experts and found true in court, the company owning the ML system is held
liable. Unethical behaviour of machine learning systems shouldn't be *too* difficult to spot,
although getting evidence might prove difficult. Public pressure and exposure of companies seems
to help too. Perhaps we could make a machine learning systems that detects unethical behaviour and
call it the ML police. Citizens could agree to install the ML police add-on to help monitor
and aggregate behaviour of online ML systems. (If these suggestions look silly, its because they
are).

Another way to deal with this is to mandate that all ML systems have a feedback feature.
The user (or a responsible guardian of the user) should be able to log on to the system, see its
past actions within a given context and rate them as ethical or unethical. The system must be
designed to use this data and give it precedence when making decisions, such that actions that are
computed to be more ethical are always picked over actions that are less ethical. In this scenario
the users are the ethicists.

The third challenge is philosophical. Until now, philosophers were content with "there is no right
answer, but there have been many thoughts on what exactly is ethical". They better get their act
together, because we'll need them to come up with a definite, quantifiable answer real soon.

On the more optimistic side, I hope that any generally agreed upon "standard" ethical system will
be a better starting point than having none at all.
