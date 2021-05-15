---
layout: post.pug
title: Absolute risk reduction and COVID vaccines
description: Why it makes no sense to use that measure for COVID vaccine experiments
date: 2021-03-07
hidden: false
---

The latest salvo of misinformation on COVID is about absolute risk reduction of COVID vaccines.
For example, [Peter Attia](https://en.wikipedia.org/wiki/Peter_Attia) posted a video on this topic
a couple of weeks ago, stating that ARR is about 1% as measured by the trials, which is completely
wrong:

<iframe width="560" height="315" src="https://www.youtube.com/embed/u1wEruG4jys" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

ARR and number needed to treat are a staple for doctors. So why is it not applicable to these COVID
vaccine trials?

To understand why, lets first briefly review how vaccine trials work.

In a vaccine trial, people are randomly chosen to be placed into two groups: a control group and
a treatment group. The treatment group is given the actual vaccine, whereas the control group is
given some placebo (saline water or an unrelated vaccine).

Importantly, in the next step participants are told to observe all precautions that non-vaccinated people
are advised to observe: to mask, to socially distance and in general to avoid situations where they
may be exposed to the virus.

Despite precautions, a percentage of participants will be unfortunate enough to be exposed to someone
infectious. When that happens, a further sub-percentage of them in both groups will become infected,
and symptomatic.

When that happens, we can measure the relative risk reduction by comparing the number of symptomatic
infected in the control group and in the intervention group. For example, if we had 100 people
infected in the control group but only 10 in the intervention, the relative risk reduction of
that vaccine would be 90%

But what about absolute risk reduction?

We can't measure that.

"Why not?" you might wonder. If we have the size of the control group - e.g. 10 000 people, and the
size of the intervention group (e.g. also 10 000 people), shouldn't the absolute risk be really easy
to calculate? i.e.

$$ ARR = { 100 \over 10 000 } - { 1 \over 10000 } = 0.9% $$

The answer is no, and here is why.

In medication experiments where we measure ARR / NNT, the medications are given to already sick
people, that is people known to be affected with the ailment that needs treatment. In that
experiment, 100% of the population is sick.

In contrast, in the vaccine experiment, only a small percentage of the population is exposed to
infectious virus. We don't know what percentage that is, but we do know that the typical prevalence
while we run these experiments is less than 2%. For example, see the [ONS survey data in England for January 2021](https://www.ons.gov.uk/peoplepopulationandcommunity/healthandsocialcare/conditionsanddiseases/bulletins/coronaviruscovid19infectionsurveypilot/8january2021) which measured 2% prevalence in England

How many people in the control and intervention group were exposed to COVID? We don't know, but
its not likely to be much higher than 1-3%, depending on the community prevalence of the disease at
the time the experiment was done.  To really measure absolute risk reduction, we would have to
ensure that everyone in both the control and the intervention group was exposed to COVID. Since its
completely unethical to run an experiment that deliberately exposes people, its not possible to
measure ARR in the same way that its measured for medications.

The best we can do is try to extrapolate what that number would be. We can assume that unless we
bring $[ R_t < 1 ]$ via other means, over time close to 80%-90% of the population will be exposed to
COVID. If our absolute risk reduction measured when there was 1.5% prevalence was 1%, then the
absolute risk reduction at 80-90% infected would probably be something closer to 50%-60%

We don't know the exact ARR of COVID vaccines. But we know that its a lot closer to RRR, and
nowhere near to the "ARR" number we can extrapolate from vaccine trials - that number is completely
meaningless and depends heavily on the prevalence of the virus at the time of the trial.