---
layout: post
title: Fixing Hacker News: A mathematical approach
description: >
  Is it possible to fix "Endless September" by simply changing the way that
  comment and submission ratings are being calculated?
date: 2012-08-21
---

There is a certain phenomenon that seems to happen in almost every online
community of user-generated content. A community is created: the initial users
define the values of this new community. After a while the community experiences
growth in numbers. As a result of that growth, users that joined before it feel
like its no longer the same community with the same values. The latest widely
discussed example seems to be
[Hacker News](http://news.ycombinator.com/item?id=4396747).


[Paul Graham responds](http://news.ycombinator.com/item?id=4397542) that the
reasons are mostly: a shift in values, increase of anonymity and the fact that
its easier to vote than to contribute content:

> _It's a genuine problem and has been growing gradually worse for a while. I think the cause is simply growth. When a good community grows, it becomes worse in two ways: (a) more recent arrivals don't have as much of whatever quality distinguished the original members, and (b) the large size of the group makes people behave worse, because there is more anonymity in a larger group._
>
> _I've spent many hours over the past several years trying to understand and mitigate such problems. I've come up with a bunch of tweaks that worked, and I have hopes I'll be able to come up with more._
>
> _The idea I'm currently investigating, in case anyone is curious, is that
> votes rather than comments may be the easiest place to attack this problem.
> Although snarky comments themselves are the most obvious symptom, I suspect
> that voting is on average dumber than commenting, because it requires so much
> less work. So I'm going to try to see if it's possible to identify people who
> consistently upvote nasty comments and if so count their votes less._

As online communities grow, the values of the group shift. The majority now may
or may not hold the same values as the majority before. The question is, how to
preserve the old values of the group with minimum side-effects?

As it happens, my master's thesis was an attempt to fix exactly this problem
mathematically and implement an improved voting system tailored specifically
for communities with user-submitted content. I won't provide a link to the
thesis as its not written in English, but I'll try to summarize the gist of it.

The voting system used in most communities today (democratic voting) is the one
most susceptible to value shift when significant growth occurs. Its
no surprise: democratic systems are designed to measure what the majority
values. When significant growth occurs, the majority changes and therefore what
they value also changes.

In contrast, previous moderator/editor based systems offer a strict filter on
content based on the more static values of the current set of editors. However,
it has the downside of being limited to what the editors are able to review and
publish.

I propose a hybrid feedback-loop based system. In this system people have
variable voting influence and editor-like individuals are given as a
"reference point" or exemplary users with maximum voting influence. The
system attempts to find out what they value and recognize it in others.

The system is based on the mathematics described in
[the beta reputation system](http://www.unik.no/people/josang/papers/JI2002-Bled.pdf),
which is a system for measuring trust in online e-commerce communities.

Here is a short description of the system:

* Voting influence is not the same for all users: its not 1 (+1 or -1) for
  everyone but in the range 0-1.
* When a user votes for a content item, they also vote for the creator (or
  submitter) of the content.
* The voting influence of a user is calculated using the positive and negative
  votes that he has received for his submissions.
* Exemplary users always have a static maximum influence.

Suppose we have a content item \\(C\\) submitted by the user \\(U_c\\). Now a voter
\\(V\\) comes to vote for it and clicks on the +1 button.

The voter has his own submissions for which he has received a total amount of
positive vote \\(p_V\\) and a total amount of negative vote \\(n_V\\). As a result,
his voting influence \\(i_V\\) is modified: its not +1 but calculated according to
the formula:

$$ i_V = f_W(p_V, n_V) $$

where \\(f_W\\) is the
[lower bound of Wilson score confidence interval](http://evanmiller.org/how-not-to-sort-by-average-rating.html).
While a simple average such as:

$$ i_V = \frac{p_V}{p_V + n_V} $$

might work when the number of positive and negative votes is large enough, its
not good enough when the number of votes is low. The Wilson score confidence
interval gives us a better, flexible balance between desired certainty in the
result and the result itself.

This vote in turn is received by the content item \\(C\\). Because its a positive
vote, the amount of positive vote \\(p_C\\) is changed for this content item

$$ p_C \leftarrow p_C + i_V $$

and as a result, it has a new rating

$$ r_c = f_W(p_c, n_c) $$

but the positive points \\(p_U\\) of the creator of the content item are also
changed:

$$ p_U \leftarrow p_U + i_V $$

and as a result the voting influence \\(i_U\\) of submitter is also changed:

$$ i_U = f_W(p_U, n_U) $$

or in other words, he has "earned" a bigger influence in the voting system by
submitting a well-rated content item.

This means that new members have no voting influence. As they submit content and
receive votes their influence may rise if the existing users with high influence
in the system consider their content to be good.

This is where the reference users \\(R\\) come in. Their influence is fixed to
always be 1

$$ i_R = 1 $$

Because of this, influence propagates through the system from them to other
users who submit content which is deemed high-quality by the reference users.
Those users in turn also change influence by voting for others and so forth.

Its also possible to scale down votes as they age. The two possible strategies
are to scale all \\(p_X\\) and \\(n_X\\) values daily, for all content items and all
users by multiplying them with a certain aging factor \\(k_a\\)

$$ p_X \leftarrow k_a p_X $$

$$ n_X \leftarrow k_a n_X $$

or to simply keep all positive and negative votes \\(V_p\\) and \\(V_n\\) in the
database and recalculate \\(p_X\\) and \\(n_X\\) according to the age of the votes
\\(a_V\\), for example:

$$ p_X = \sum_{\forall V_p} { i_V k_a^{a_V} } $$

$$ n_X = \sum_{\forall V_n} { i_V k_a^{a_V} } $$

One of the convenient aspects of this system is that its easy to test-drive. It
doesn't require more user action than simple democratic voting. It only requires
an administrator to specify some reference users at the start which seed and
then propagate influence throughout the system.

I tested this system on a forum dataset (details available on request) and found
that the system achieves around 50% reduction of difference from a moderator
only system compared to scores of a democratic system, even when the direct
voting of reference users is turned off for content items and only the indirect
(to other users) influence is counted. \\((p < 0.05)\\)

What does a 50% reduction in the difference mean? Let the score of a content
item \\(C\\) be measured in 3 systems: democratic \\(D\\), reference-users-only
\\(R\\) and hybrid \\(H\\) with direct influence of reference users to content items
being turned off. By sorting the items according to those scores we can
calculate their ranks in the 3 systems: \\(r_D\\), \\(r_R\\) and \\(r_H\\)
respectively. The value of the rank is in the range \\(1\\) to \\(n\\), where \\(n\\)
is total number of content items. The absolute difference between the democratic
ranking and the reference ranking \\(d_{DR}\\) is:

$$ d_{DR} = abs(r_D - r_R) $$

while the absolute difference between the hybrid ranking and the reference
ranking \\(d_{HR}\\) is:

$$ d_{HR} = abs(r_H - r_R) $$

and it turns out that on average,

$$ d_{HR} = 0.5 d_{DR} $$

The important downside of these results is that the people using the system were
not aware that points are calculated in a different way. The original votes were
given by people who knew that the system is democratic and acted accordingly. It
remains to be seen what the results would be if people are aware that their
voting influence depends on the way others vote for their submitted content.

I pondered starting a website similar to hacker news based on this voting and
scoring scheme, however starting a whole new news website is about much more
than just scoring algorithms (it requires reputation in the online comminty,
popularity and most importantly time, none of which I presently have in
sufficient amounts or know how to achieve). But hopefully, pg and the rest of
the hacker news team might find this scheme useful enough to somehow incorporate
it into the existing scoring system.
