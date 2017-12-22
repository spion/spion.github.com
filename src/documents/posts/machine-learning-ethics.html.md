---
title: Machine learning ethics
description: Can be terrifying.
date: 2017-12-19
layout: post
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
a history of prevoius actions and the context they were run in and how well they achieved that goal.
The system should learn on the historical data and be able to predict what action it can select to
best achieve the goal.

The goal could be e.g. to maximise the time the user stays on a video sharing website like YouTube.
More generally, a value function is given by the ML system creator that measures the desireability
of a certain outcome or behaviour (it could include multiple things like number of product bought,
number of ads clicked or viewed, etc).

In the case of YouTube, the action the system can take is show a certain list of videos in the
sidebar on the right. Every different set of videos would be a different alternative, and could
cause the user to either stay on YouTube longer or perhaps leave the site.

Finally, the history of actions is a list of all previous video lists shown in the sidebar to users,
the time the users spent on the website after seeing that list (or the result of the value function)
as well as contextual information about that situation: which user was it, what was their personal
information, their past watching history, the channels they're subscribed to etc.

Based on this data, the system learns how to tailor its actions (the videos it shows) so that it
achieves the goal (causes a particular user in a particular situation to stay longer on the
website).

At the beginning it will try random things. After several iterations, it will find things that
"stick" i.e. maximise the value. There are sophisticated techniques to get unstuck from local
maximums too, in order to find even bigger maximums.

Once trained with sufficient data, it will be able to do some calculations and conclude: "well,
when I encountered a situation like this other times, I tried these five options, and option two
on average caused users like this one to stay the longest, so I'll do that".

Sure, there are ways to ask some ML systems why they made a decision after the fact, and they can
elaborate the variables that had the most effect. But before the algorithm gets the training data,
you *don't* know what it will decide - nobody does! It learns from the history of its own actions
and how the users reacted to them, so in essence, the users are the ones training it.

Remember there are millions of people visiting YouTube every day, so the algorithm can try a
lot of stuff in a very short time. After a while it will start noticing certain patterns. For
example, it seems that people who generally watch cat videos will stay a lot longer if they are
given cat videos in their suggestion box.  Moreover, that will happen even if situations when they
are watching something else, like academic lecture material.

This raises a very important question - is the system behaving in an ethical manner? Is it ethical
to show cat videos to a person trying to study and nudge them towards wasting their time? Even that
is a fairly benign example. There are far worse examples mentioned in the TED talk above.

The root of the problem is the value function. Our systems are often blisfully unaware of any side
effects their decision may cause and blatantly disregard basic rules of behaviour that we take for
granted. They have no other values than the value function they're maximizing. For them, the end
justifies the means. Whether the value function is maximized by manipulating people, preying on
their insecurities, making them scared, angry or sad - all of that is unimportant. If they find that
the most effective way to keep a person on the same page is to show them something that will render
them unconscious, they would happily do that.

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
computed to be more ethical are always picked over actions that are less ethical.

The third challenge is philosophical. Until now, philosophers were content with "there is no right
answer, but there have been many thoughts on what exactly is ethical". They better get their act
together, because we'll need them to come up with a definite, quantifiable answer real soon.

On the more optimistic side, I hope that any generally agreed upon "standard" ethical system will
be a better starting point than having none at all.
